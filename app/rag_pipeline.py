import os
import time
import logging
import re

from typing import List, Dict, Optional
from dotenv import load_dotenv
import json
import pymupdf


# LangChain imports
from langchain_community.document_loaders import TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain_community.callbacks.manager import get_openai_callback
from langchain.embeddings.base import Embeddings
from openai import OpenAI
from langchain_community.document_loaders import PyPDFLoader, PyMuPDFLoader, PDFMinerLoader
from langchain.schema import Document

load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ImprovedPDFLoader:
    """Enhanced PDF loader with multiple fallback options"""
    
    @staticmethod
    def load_pdf(file_path: str, preferred_method: str = "pymupdf"):
        """
        Load PDF with multiple fallback methods
        
        Args:
            file_path: Path to the PDF file
            preferred_method: 'pymupdf', 'pypdf', or 'pdfminer'
        """
        if not os.path.exists(file_path):
            logger.error(f"PDF file not found: {file_path}")
            return []
        
        methods = {
            'pymupdf': lambda: PyMuPDFLoader(file_path).load(),
            'pypdf': lambda: PyPDFLoader(file_path).load(),
            'pdfminer': lambda: PDFMinerLoader(file_path).load()
        }
        
        # Try preferred method first
        try:
            logger.info(f"Loading PDF using {preferred_method}")
            documents = methods[preferred_method]()
            logger.info(f"Successfully loaded {len(documents)} pages with {preferred_method}")
            return documents
        except Exception as e:
            logger.warning(f"{preferred_method} failed: {e}")
        
        # Try fallback methods
        for method_name, method_func in methods.items():
            if method_name == preferred_method:
                continue
                
            try:
                logger.info(f"Trying fallback method: {method_name}")
                documents = method_func()
                logger.info(f"Successfully loaded {len(documents)} pages with {method_name}")
                return documents
            except Exception as e:
                logger.warning(f"{method_name} failed: {e}")
        
        logger.error("All PDF loading methods failed")
        return []

class JSONLoader:
    """Load structured Q&A pairs from JSON into LangChain Documents"""

    @staticmethod
    def load_json(file_path: str):
        if not os.path.exists(file_path):
            logger.error(f"JSON file not found: {file_path}")
            return []

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            documents = []
            for i, item in enumerate(data):
                question = item.get("question", "").strip()
                answer = item.get("answer", "").strip()
                source = item.get("source", "Nigerian Business Dataset")

                # Create separate documents for better retrieval
                # Document 1: Question-focused for better matching
                question_doc = Document(
                    page_content=f"Q: {question}\nA: {answer}",
                    metadata={
                        "source": source,
                        "type": "qa_pair",
                        "question": question,
                        "answer": answer,
                        "index": i
                    }
                )
                
                # Document 2: Answer-focused for context
                answer_doc = Document(
                    page_content=f"Answer: {answer}\nRelated Question: {question}",
                    metadata={
                        "source": source,
                        "type": "answer_focused",
                        "question": question,
                        "answer": answer,
                        "index": i
                    }
                )
                
                documents.extend([question_doc, answer_doc])

            logger.info(f"Loaded {len(documents)} documents from {len(data)} Q&A pairs")
            return documents

        except Exception as e:
            logger.error(f"Error loading JSON: {e}")
            return []


class NebiusEmbeddings(Embeddings):
    def __init__(self, api_key: str, model: str = "BAAI/bge-multilingual-gemma2"):
        self.client = OpenAI(
            api_key=api_key,
            base_url="https://api.studio.nebius.com/v1/"
        )
        self.model = model

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Embed a list of documents and return embeddings"""
        if not texts:
            logger.warning("No texts provided for embedding")
            return []
        
        embeddings = []
        for i, text in enumerate(texts):
            try:
                # Log progress for large batches
                if i % 10 == 0:
                    logger.info(f"Processing embedding {i+1}/{len(texts)}")
                
                embedding = self.embed_query(text)
                embeddings.append(embedding)
                
                # Add small delay to avoid rate limiting
                if i % 5 == 0 and i > 0:
                    time.sleep(0.1)
                    
            except Exception as e:
                logger.error(f"Error embedding document {i}: {e}")
                # Continue with other documents instead of failing completely
                continue
        
        logger.info(f"Successfully embedded {len(embeddings)}/{len(texts)} documents")
        return embeddings

    def embed_query(self, text: str) -> List[float]:
        """Embed a single query text"""
        if not text or not text.strip():
            logger.warning("Empty text provided for embedding")
            return [0.0] * 1024  # Return zero vector with expected dimensions
        
        try:
            response = self.client.embeddings.create(
                model=self.model,
                input=text.strip()
            )
            
            if not response.data:
                logger.error("No embedding data returned from API")
                return [0.0] * 1024
            
            return response.data[0].embedding
            
        except Exception as e:
            logger.error(f"Error calling embedding API: {e}")
            # Return a zero vector to prevent complete failure
            return [0.0] * 1024

class RAGPipeline:
    def __init__(self):
        """Initialize RAG pipeline with Nebius AI Studio only"""
        
        # Validate API key
        self.api_key = os.getenv("NEBIUS_API_KEY")
        if not self.api_key:
            raise ValueError("NEBIUS_API_KEY not found in environment variables")
        
        # Setup embeddings with Nebius
        self.embeddings = NebiusEmbeddings(
            api_key=self.api_key,
            model="BAAI/bge-multilingual-gemma2"
        )
        
        # Setup Llama 3.1 with optimized parameters
        from langchain_openai import ChatOpenAI
        self.llm = ChatOpenAI(
            model="meta-llama/Meta-Llama-3.1-8B-Instruct",
            temperature=0.1,
            max_tokens=512,
            top_p=0.9,
            frequency_penalty=0.1,
            openai_api_key=self.api_key,
            openai_api_base="https://api.studio.nebius.com/v1/",
            request_timeout=30,
            max_retries=3
        )
        
        self.vector_store = None
        self.qa_chain = None
        self.query_count = 0
        self.total_cost = 0.0
        self.kb_type = None 
        self.qa_lookup = {}  # Direct lookup for exact matches
        
        logger.info("Nebius AI Studio initialized with Meta-Llama-3.1-8B-Instruct")
        
        # Improved JSON prompt template
        self.prompt_template_json = """<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are BizBot Nigeria, an AI assistant specializing in Nigerian business regulations and procedures.

Instructions for Q&A dataset responses:
1. FIRST check if the context contains a direct answer to the user's question
2. If you find a direct answer, provide it exactly as written in the dataset
3. If no exact match, synthesize information from multiple relevant Q&A pairs
4. Always cite sources when available
5. If no relevant information exists, clearly state this limitation
6. Be concise and professional in your responses
<|eot_id|>

<|start_header_id|>user<|end_header_id|>
Context from knowledge base:
{context}

User Question: {question}

Please provide a direct answer based on the context above.
<|eot_id|>

<|start_header_id|>assistant<|end_header_id|>"""

        # Regular prompt for non-JSON sources
        self.prompt_template = """<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are BizBot Nigeria, an AI assistant specializing in Nigerian business regulations and procedures. You provide accurate, step-by-step guidance based on official government sources.

Core Guidelines:
- Answer ONLY based on the provided context
- If information is missing, clearly state "This information is not available in my current knowledge base"
- Include specific requirements, fees, timelines, and contact details
- Reference Nigerian agencies: CAC, FIRS, CBN
- Provide actionable steps in numbered lists when appropriate
- Be professional and precise
- Understand the user’s context (e.g., caterer, freelancer, NGO) and adapt the business registration steps accordingly.
- If user mentions a role, map it to the most relevant Nigerian business type (e.g., caterer → food services business → Business Name or Company registration with CAC).
- Provide step-by-step instructions for registration, including required documents, costs, and regulatory agencies.
- Always cite sources if available.

Question: {question}
<|eot_id|>

<|start_header_id|>assistant<|end_header_id|>"""

    def _build_qa_lookup(self, documents):
        """Build a direct lookup dictionary for exact question matches"""
        self.qa_lookup = {}
        
        for doc in documents:
            if doc.metadata.get("type") == "qa_pair":
                question = doc.metadata.get("question", "").lower().strip()
                answer = doc.metadata.get("answer", "").strip()
                source = doc.metadata.get("source", "")
                
                # Store multiple variations of the question
                self.qa_lookup[question] = {
                    "answer": answer,
                    "source": source,
                    "original_question": doc.metadata.get("question", "")
                }
                
                # Also store without punctuation
                clean_question = question.replace("?", "").replace(".", "").replace(",", "")
                self.qa_lookup[clean_question] = {
                    "answer": answer,
                    "source": source,
                    "original_question": doc.metadata.get("question", "")
                }

    def setup_knowledge_base(self, documents_path: str = "data/scraped_content/business_knowledge_base.txt"):
        """Setup knowledge base optimized for Llama 3.1"""
        try:
            start_time = time.time()
            
            # Load from JSON if file is .json
            if documents_path.endswith(".json"):
                documents = JSONLoader.load_json(documents_path)
                self.kb_type = "json"
                # Build direct lookup for JSON data
                self._build_qa_lookup(documents)
            elif documents_path.endswith(".pdf"):
                documents = ImprovedPDFLoader.load_pdf(documents_path, preferred_method="pymupdf")
                self.kb_type = "pdf"
            else:
                raise ValueError("Unsupported file type. Use .pdf or .json")

            # Fallback if no docs
            if not documents:
                documents = self._create_nigerian_business_data()
            
            # Optimize text splitting for JSON Q&A pairs
            if self.kb_type == "json":
                # For Q&A pairs, use larger chunks and avoid splitting on question marks
                text_splitter = RecursiveCharacterTextSplitter(
                    chunk_size=1000,  # chunks for Q&A pairs
                    chunk_overlap=100,
                    length_function=len,
                    separators=["\n\n", "\n", ". ",  " ", ""]
                )
            else:
                # Standard chunking for other document types
                text_splitter = RecursiveCharacterTextSplitter(
                    chunk_size=800,
                    chunk_overlap=100,
                    length_function=len,
                    separators=["\n\n", "\n", ". ", ".", " ", ""]
                )
                
            texts = text_splitter.split_documents(documents)
            logger.info(f"Created {len(texts)} document chunks")
            
            # Create vector store
            self.vector_store = FAISS.from_documents(texts, self.embeddings)
            
            # Save vector store for persistence
            vector_store_path = "data/vector_store"
            os.makedirs(vector_store_path, exist_ok=True)
            self.vector_store.save_local(vector_store_path)
            
            # Setup QA chain with improved retrieval
            if documents_path.endswith(".json"):
                prompt = PromptTemplate(
                    template=self.prompt_template_json,
                    input_variables=["context", "question"]
                )
                # Use more aggressive retrieval for Q&A pairs
                retriever_kwargs = {"k": 8, "fetch_k": 30, "lambda_mult": 0.3}
            else:
                prompt = PromptTemplate(
                    template=self.prompt_template,
                    input_variables=["context", "question"]
                )
                retriever_kwargs = {"k": 4, "fetch_k": 12, "lambda_mult": 0.7}
            
            self.qa_chain = RetrievalQA.from_chain_type(
                llm=self.llm,
                chain_type="stuff",
                retriever=self.vector_store.as_retriever(
                    search_type="mmr",
                    search_kwargs=retriever_kwargs
                ),
                chain_type_kwargs={"prompt": prompt},
                return_source_documents=True
            )
            
            setup_time = time.time() - start_time
            logger.info(f"Knowledge base setup completed in {setup_time:.2f}s")
            logger.info(f"Built direct lookup with {len(self.qa_lookup)} entries")
            
        except Exception as e:
            logger.error(f"Setup error: {e}")
            raise e

    def _exact_match_lookup(self, question: str) -> Dict:
        """Try to find exact matches in the Q&A lookup"""
        question_clean = question.lower().strip()
        
        # Try exact match first
        if question_clean in self.qa_lookup:
            result = self.qa_lookup[question_clean]
            return {
                "answer": result["answer"],
                "sources": [result["source"]] if result["source"] else ["Nigerian Business Dataset"],
                "confidence": "high",
                "confidence_score": 1.0,
                "cost": 0.0,
                "response_time": 0.01,
                "match_type": "exact"
            }
        
        # Try without punctuation
        question_no_punct = question_clean.replace("?", "").replace(".", "").replace(",", "").strip()
        if question_no_punct in self.qa_lookup:
            result = self.qa_lookup[question_no_punct]
            return {
                "answer": result["answer"],
                "sources": [result["source"]] if result["source"] else ["Nigerian Business Dataset"],
                "confidence": "high",
                "confidence_score": 0.95,
                "cost": 0.0,
                "response_time": 0.01,
                "match_type": "exact_no_punct"
            }
        
        # Try fuzzy matching for similar questions
        for stored_question, result in self.qa_lookup.items():
            # Simple word overlap check
            question_words = set(question_no_punct.split())
            stored_words = set(stored_question.split())
            # Remove common stop words for better matching
            stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'can', 'could', 'should', 'would', 'will', 'shall', 'may', 'might', 'must', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'our', 'their'}

            question_words = question_words - stop_words
            stored_words = stored_words - stop_words

            overlap = len(question_words.intersection(stored_words))
            total_words = len(question_words.union(stored_words))
            
            if total_words > 0:
                similarity = overlap / total_words
                if similarity > 0.6:  # lower similarity threshold
                    return {
                        "answer": result["answer"],
                        "sources": [result["source"]] if result["source"] else ["Nigerian Business Dataset"],
                        "confidence": "high",
                        "confidence_score": round(similarity, 2),
                        "cost": 0.0,
                        "response_time": 0.01,
                        "match_type": f"fuzzy_match_{similarity:.2f}"
                    }
        
        return None
    
    def classify_query_type(self, question: str) -> str:
        """Classify query type: business, greeting, or other"""
        question_lower = question.lower().strip()
        
        # Nigerian language greetings
        yoruba_greetings = [
            'bawo', 'bawo ni', 'se daada ni', 'pele', 'e kaaro', 'e kaasan', 'e kaalẹ',
            'ẹ ku aaro', 'ẹ ku ọsan', 'ẹ ku alẹ', 'se alafia ni'
        ]
        
        igbo_greetings = [
            'ndewo', 'kedu', 'kedu ka i mere', 'nno', 'nnukwu ndewo',
            'ụtụtụ ọma', 'ehihie ọma', 'mgbede ọma'
        ]
        
        hausa_greetings = [
            'sannu', 'ina kwana', 'ina gari', 'barka da safiya',
            'barka da rana', 'barka da yamma', 'kana lafiya'
        ]
        
        english_greetings = [
            'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
            'how are you', 'whats up', 'greetings', 'nice to meet you'
        ]
        
        # Business-related keywords
        business_keywords = [
            'business', 'company', 'register', 'registration', 'cac', 'firs', 'tax',
            'license', 'permit', 'bank', 'account', 'incorporation', 'fee', 'cost',
            'document', 'requirement', 'process', 'step', 'how to', 'procedure'
        ]
        
        # Check for greetings
        all_greetings = yoruba_greetings + igbo_greetings + hausa_greetings + english_greetings
        if any(greeting in question_lower for greeting in all_greetings):
            return "greeting"
        
        # Check for business queries
        if any(keyword in question_lower for keyword in business_keywords):
            return "business"
        
        return "other"

    def handle_greeting(self, question: str) -> Dict:
        """Handle greetings in multiple Nigerian languages"""
        question_lower = question.lower().strip()
        
        # Determine language and respond appropriately
        if any(word in question_lower for word in ['bawo', 'se daada', 'pele', 'kaaro', 'kaasan']):
            # Yoruba greeting
            response = """Ẹ ku aaro! (Good morning!) / Ẹ ku ọsan! (Good afternoon!)

Mo jẹ́ BizBot Nigeria - oluranlowo ti o le ran yin lowo pelu awon ibeere nipa eto isowo ni Nigeria.

I am BizBot Nigeria - an assistant that can help you with questions about business procedures in Nigeria.

How can I help you with your business needs today?"""
            
        elif any(word in question_lower for word in ['ndewo', 'kedu', 'nno', 'ụtụtụ']):
            # Igbo greeting  
            response = """Ndewo! Kedu ka ị mere?

Abụ m BizBot Nigeria - onye inyeaka nke nwere ike inyere gị aka na ajụjụ gbasara usoro azụmahịa na Nigeria.

I am BizBot Nigeria - an assistant that can help you with questions about business procedures in Nigeria.

How can I help you with your business needs today?"""
            
        elif any(word in question_lower for word in ['sannu', 'ina kwana', 'ina gari', 'barka']):
            # Hausa greeting
            response = """Sannu! Ina gari?

Ni ne BizBot Nigeria - mataimaki da zai iya taimaka muku da tambayoyi game da hanyoyin kasuwanci a Nigeria.

I am BizBot Nigeria - an assistant that can help you with questions about business procedures in Nigeria.

How can I help you with your business needs today?"""
            
        else:
            # English greeting
            response = """Hello! How are you doing?

I am BizBot Nigeria - your AI assistant for Nigerian business regulations and procedures.

I can help you with:
• Company registration with CAC
• Tax requirements with FIRS  
• Banking procedures
• Business licenses and permits
• Regulatory compliance

What business question can I help you with today?"""
        
        return {
            "answer": response,
            "sources": [],
            "confidence": "medium",
            "confidence_score": 0.4,
            "cost": 0.0,
            "response_time": 0.01
        }

    def handle_non_business_query(self, question: str) -> Dict:
        """Handle non-business queries politely"""
        return {
            "answer": """I'm BizBot Nigeria, specialized in helping with Nigerian business regulations and procedures.

I can assist you with:
• Company and business name registration
• Tax obligations and FIRS requirements
• Banking and financial procedures  
• Business licenses and permits
• CAC processes and requirements

Please ask me a question about Nigerian business procedures, and I'll be happy to help!""",
            
            "sources": [],
            "confidence": "low", 
            "confidence_score": 0.2,
            "cost": 0.0,
            "response_time": 0.01
        }

    def _preprocess_question(self, question):
        """
        Normalize role-specific queries into more general business registration terms.
        Returns (normalized_question, detected_role).
        """
        role_mappings = {
            "caterer": "food business",
            "restaurant": "food business",
            "chef": "food services business",
            "freelancer": "sole proprietorship",
            "consultant": "sole proprietorship",
            "ngo": "non-profit organization",
            "importer": "import/export business",
            "exporter": "import/export business",
            "farmer": "agriculture business",
            "retailer": "trading business"
        }

        q_lower = question.lower()
        for keyword, mapped in role_mappings.items():
            if re.search(rf"\b{keyword}\b", q_lower):
                return f"How do I register a {mapped} in Nigeria?", keyword
        return question, None

    def query(self, question: str) -> Dict:
        """Enhanced query with better JSON handling"""

        # Step 1: Preprocess role-specific context
        normalized_question, detected_role = self._preprocess_question(question)

        # Step 2: Classify query type
        query_type = self.classify_query_type(normalized_question)

        if query_type == "greeting":
            return self.handle_greeting(normalized_question)
        elif query_type == "other":
            if self.kb_type == "json":
                exact_result = self._exact_match_lookup(normalized_question)
                if exact_result:
                    logger.info("Found exact match despite 'other' classification")
                    if detected_role:
                        exact_result["answer"] += f"\n\n(Adapted for your role: {detected_role})"
                    return exact_result
        
            return self.handle_non_business_query(normalized_question)
    
        # JSON Knowledge Base Mode with exact matching
        if self.kb_type == "json":
            # Try exact match first
            exact_result = self._exact_match_lookup(normalized_question)
            if exact_result:
                if detected_role:
                    exact_result["answer"] += f"\n\n(Adapted for your role: {detected_role})"
                return exact_result

            # If no exact match, try vector search with higher threshold
            if self.vector_store:
                docs = self.vector_store.similarity_search_with_score(normalized_question, k=5)
                
                if docs:
                    best_doc, score = docs[0]
                    similarity = 1 - score  # Convert distance to similarity
                    logger.info(f"Vector similarity score: {score:.4f}")
                    
                    # Lower threshold since we want to catch more relevant answers
                    if similarity > 0.3:  # Adjust threshold for JSON data
                        # Extract answer from the document
                        content = best_doc.page_content
                        
                        # Try to extract clean answer
                        if "A: " in content:
                            answer = content  .split("A: ", 1)[1].strip()
                        elif "Answer: " in content:
                            answer = content.split("Answer: ", 1)[1].strip()
                            if "\nRelated Question:" in answer:
                                answer = answer.split("\nRelated Question:")[0].strip()
                        else:
                            answer = content.strip()
                        
                        return {
                            "answer": answer,
                            "sources":[{
                                "source": best_doc.metadata.get("source", "Nigerian Business Dataset"),
                                "excerpt": best_doc.page_content[:120] + "..."
                            }],
                            "confidence": "high" if similarity > 0.7 else "medium",
                            "confidence_score": round(similarity, 2), # Convert distance to similarity
                            "cost": 0.0,
                            "response_time": 0.02,
                            "match_type": "vector_search"
                        }
                
                logger.info("Low similarity, falling back to LLM chain...")

        # Fallback to LLM QA chain
        if not self.qa_chain:
            return {
                "answer": "Knowledge base not initialized. Please contact support.",
                "sources": [],
                "confidence": "low",
                "cost": 0.0,
                "response_time": 0.0
            }

        start_time = time.time()
        self.query_count += 1

        try:
            with get_openai_callback() as cb:
                result = self.qa_chain({"query": normalized_question})
                query_cost = cb.total_cost
                self.total_cost += query_cost

            # Extract sources
            sources = []
            confidence_score = 0.6
            if "source_documents" in result:
                sources = [
                    {
                        "source": doc.metadata.get("source", "Nigerian Business Database"),
                        "excerpt": doc.page_content[:120] + "..."
                    }
                    for doc in result["source_documents"]
                ]
                # confidence_score = self._calculate_confidence(result["source_documents"], question)
            response_time = time.time() - start_time
            answer = result["result"]
            if detected_role:
                answer += f"\n\n(Adapted for your role: {detected_role})"


            return {
                "answer": answer,
                "sources": sources,
                "confidence": self._get_confidence_level(confidence_score),
                "confidence_score": confidence_score,
                "cost": round(query_cost, 4),
                "response_time": round(response_time, 2)
            }

        except Exception as e:
            logger.error(f"Query error: {e}")
            return {
                "answer": f"I encountered an error processing your question. Please try again. Error: {str(e)}",
                "sources": [],
                "confidence": "low",
                "cost": 0.0,
                "response_time": 0.0
            }

    def batch_query(self, questions: List[str]) -> List[Dict]:
        """Process multiple queries efficiently"""
        results = []
        start_time = time.time()
        
        logger.info(f"Processing {len(questions)} batch queries...")
        
        for i, question in enumerate(questions, 1):
            logger.info(f"Processing query {i}/{len(questions)}")
            result = self.query(question)
            results.append(result)
        
        total_time = time.time() - start_time
        total_cost = sum(r.get('cost', 0) for r in results)
        
        logger.info(f"Batch completed: {total_time:.2f}s, ${total_cost:.4f}")
        
        return results
    
    def _calculate_confidence(self, docs, question):
        """Calculate confidence score based on document relevance"""
        if not docs:
            return 0.0
        
        question_words = set(question.lower().split())
        business_keywords = {'business', 'company', 'registration', 'tax', 'bank', 'nigeria', 'cac', 'firs'}
        
        total_score = 0
        for doc in docs:
            doc_words = set(doc.page_content.lower().split())
            
            # Basic word overlap
            word_overlap = len(question_words.intersection(doc_words))
            
            # Bonus for business-specific terms
            business_overlap = len(business_keywords.intersection(doc_words))
            
            # Bonus for exact phrase matches
            phrase_bonus = 2 if any(phrase in doc.page_content.lower() 
                                  for phrase in [question.lower()[:30]]) else 0
            
            doc_score = word_overlap + business_overlap + phrase_bonus
            total_score += doc_score
        
        # Normalize score
        max_possible = len(question_words) * len(docs) + len(business_keywords) + 2
        return min(total_score / max_possible, 1.0)
    
    def _get_confidence_level(self, score):
        """Convert confidence score to level"""
        if score >= 0.7:
            return "high"
        elif score >= 0.4:
            return "medium"
        else:
            return "low"
    
    def health_check(self) -> Dict:
        """Check system health with Nigerian business queries"""
        test_queries = [
            "How do I register a company with CAC?",
            "What are the FIRS tax requirements for businesses?",
            "How do I open a corporate bank account in Nigeria?"
        ]
        
        try:
            results = []
            for question in test_queries:
                result = self.query(question)
                results.append({
                    "question": question,
                    "success": len(result["answer"]) > 50 and "error" not in result["answer"].lower(),
                    "confidence": result["confidence"],
                    "response_time": result["response_time"]
                })
            
            success_rate = sum(1 for r in results if r["success"]) / len(results)
            avg_response_time = sum(r["response_time"] for r in results) / len(results)
            
            status = "healthy" if success_rate >= 0.8 else "degraded"
            
            return {
                "status": status,
                "success_rate": round(success_rate, 2),
                "avg_response_time": round(avg_response_time, 2),
                "model": "meta-llama/Meta-Llama-3.1-8B-Instruct",
                "provider": "Nebius AI Studio",
                "details": results
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }
    
    def get_stats(self) -> Dict:
        """Get pipeline performance statistics"""
        return {
            "total_queries": self.query_count,
            "total_cost": round(self.total_cost, 4),
            "avg_cost_per_query": round(self.total_cost / max(self.query_count, 1), 4),
            "model": "meta-llama/Meta-Llama-3.1-8B-Instruct",
            "provider": "Nebius AI Studio",
            "status": "active",
            "qa_lookup_size": len(self.qa_lookup)
        }
    
    def _create_nigerian_business_data(self):
        """Comprehensive Nigerian business knowledge base"""
        from langchain.schema import Document
        
        return [
            Document(
                page_content="""
                BUSINESS REGISTRATION WITH CORPORATE AFFAIRS COMMISSION (CAC)
                
                CAC is Nigeria's official business registration body. Location: Plot 420, Tigris Crescent, Maitama, Abuja.
                
                TYPES OF BUSINESS ENTITIES:
                1. Business Name (Sole Proprietorship) - ₦10,000
                2. Partnership - ₦10,000  
                3. Private Limited Company (Ltd) - ₦15,000
                4. Public Limited Company (Plc) - ₦50,000
                5. Limited Liability Partnership (LLP) - ₦20,000
                
                PRIVATE LIMITED COMPANY REGISTRATION PROCESS:
                
                Step 1: Name Search & Reservation
                - Complete Form CAC 1.1
                - Pay ₦500 for name search
                - Get name availability within 24 hours
                
                Step 2: Document Preparation
                Required documents:
                - Form CAC 2.1 (Memorandum & Articles)
                - Form CAC 7 (Particulars of Directors)
                - Evidence of address for directors
                - Valid ID copies of shareholders/directors
                - Passport photographs
                
                Step 3: Payment & Submission
                - Authorized share capital up to ₦1,000,000: ₦10,000
                - ₦1,000,001 - ₦5,000,000: ₦15,000
                - Above ₦5,000,000: ₦20,000
                - Processing time: 3-5 working days
                
                POST-INCORPORATION REQUIREMENTS:
                1. Tax Identification Number (TIN) registration with FIRS
                2. VAT registration (if turnover > ₦25M)
                3. PAYE registration for employees
                4. PENCOM registration for employees' pension
                5. NSITF registration for employees' insurance
                
                CAC CONTACT INFORMATION:
                Website: www.cac.gov.ng
                Email: info@cac.gov.ng
                Phone: 0700-CALL-CAC (0700-2255-222)
                Address: Plot 420, Tigris Crescent, Maitama, Abuja
                """,
                metadata={"source": "CAC Official Registration Guide 2024"}
            ),
            
            Document(
                page_content="""
                FEDERAL INLAND REVENUE SERVICE (FIRS) TAX OBLIGATIONS
                
                FIRS Location: 15 Sokode Crescent, Wuse Zone 5, Abuja
                
                COMPANY INCOME TAX (CIT) RATES 2024:
                - Small Companies (turnover ≤ ₦25 million): 20%
                - Medium Companies (₦25M - ₦100M): 20%
                - Large Companies (> ₦100 million): 30%
                - Minimum Tax: 0.5% of turnover when no assessable profit
                
                VALUE ADDED TAX (VAT):
                - Current Rate: 7.5%
                - Registration Threshold: ₦25,000,000 annual turnover
                - Exempt items: Basic food items, medical services, educational services
                - Zero-rated: Exports, goods/services in free trade zones
                
                PAY AS YOU EARN (PAYE) TAX BANDS:
                - First ₦300,000 annually: 7%
                - Next ₦300,000: 11% 
                - Next ₦500,000: 15%
                - Next ₦500,000: 19%
                - Next ₦1,600,000: 21%
                - Above ₦3,200,000: 24%
                - Personal Relief Allowance: ₦200,000
                
                FILING DEADLINES:
                - CIT Annual Returns: March 31st
                - VAT Monthly Returns: 21st of following month
                - WHT Monthly Returns: 21st of following month
                - PAYE Monthly Returns: 10th of following month
                
                PENALTIES FOR LATE FILING:
                - CIT: 5% of tax payable + ₦25,000
                - VAT: 5% per month of tax due
                - PAYE: 10% of tax due + ₦25,000
                
                FIRS CONTACT:
                Website: www.firs.gov.ng
                Email: contact@firs.gov.ng  
                Phone: 0700-CALL-FIRS (0700-2255-3477)
                """,
                metadata={"source": "FIRS Tax Guidelines 2024"}
            ),
            
            Document(
                page_content="""
                CORPORATE BANKING REQUIREMENTS IN NIGERIA
                
                Central Bank of Nigeria (CBN) regulated banks for corporate accounts:
                
                TIER 1 BANKS MINIMUM OPENING BALANCE:
                - Access Bank: ₦100,000
                - Guaranty Trust Bank (GTBank): ₦100,000
                - First Bank of Nigeria: ₦50,000
                - United Bank for Africa (UBA): ₦100,000
                - Zenith Bank: ₦100,000
                - Ecobank Nigeria: ₦100,000
                
                REQUIRED DOCUMENTS FOR ACCOUNT OPENING:
                1. Certificate of Incorporation (CAC)
                2. Memorandum & Articles of Association (Form CAC 2)
                3. Form CAC 7 (Directors' Particulars)
                4. Board Resolution authorizing account opening
                5. Tax Identification Number (TIN) Certificate
                6. Valid ID of all directors and signatories
                7. Utility bills for business address
                8. Business permit/license (where applicable)
                9. Two passport photographs of signatories
                
                ACCOUNT TYPES AVAILABLE:
                1. Current Account - for daily business operations
                2. Savings Account - for business reserves
                3. Fixed Deposit Account - for investments
                4. Domiciliary Account - for foreign currency transactions
                
                ACCOUNT CHARGES (Average):
                - Account maintenance: ₦1,000 - ₦5,000 monthly
                - SMS alerts: ₦4 per SMS
                - Inter-bank transfers: ₦50 - ₦100
                - Internet banking: Free - ₦1,000 monthly
                
                PROCESSING TIME:
                - Documentation review: 2-3 days
                - Account activation: 5-10 working days
                - Debit card issuance: 7-14 days
                
                CBN CONTACT:
                Website: www.cbn.gov.ng
                Phone: +234-9-4612305
                Address: Central Bank of Nigeria, Central Business District, Abuja
                """,
                metadata={"source": "CBN Banking Guidelines 2024"}
            ),
            
            Document(
                page_content="""
                BUSINESS PERMITS AND LICENSES IN NIGERIA
                
                FEDERAL LEVEL PERMITS:
                
                1. NAFDAC REGISTRATION (Food, Drugs, Cosmetics):
                - Application fee: ₦100,000 - ₦500,000
                - Processing time: 90 days
                - Renewal: Every 5 years
                - Contact: www.nafdac.gov.ng
                
                2. SON STANDARDS (Manufacturing):
                - Mandatory Conformity Assessment Programme (MANCAP)
                - Fee: ₦50,000 - ₦200,000
                - Contact: www.son.gov.ng
                
                3. NBC LICENSE (Broadcasting):
                - Radio license: ₦10,000,000
                - TV license: ₦15,000,000
                - Contact: www.nbc.gov.ng
                
                STATE LEVEL PERMITS:
                
                1. Business Premises Permit:
                - Lagos: ₦25,000 - ₦100,000
                - Abuja: ₦20,000 - ₦80,000
                - Rivers: ₦15,000 - ₦60,000
                
                2. Signage Permit:
                - Lagos: ₦50,000 - ₦200,000
                - Abuja: ₦30,000 - ₦150,000
                
                SECTOR-SPECIFIC LICENSES:
                
                1. Oil & Gas: Department of Petroleum Resources (DPR)
                2. Banking: Central Bank of Nigeria (CBN)
                3. Insurance: National Insurance Commission (NAICOM)
                4. Telecom: Nigerian Communications Commission (NCC)
                5. Aviation: Nigerian Civil Aviation Authority (NCAA)
                
                PROCESSING TIPS:
                - Apply online where possible for faster processing
                - Ensure all documents are properly certified
                - Follow up regularly on application status
                - Budget for renewal fees in business planning
                """,
                metadata={"source": "Business Licensing Guide Nigeria 2024"}
            )
        ]