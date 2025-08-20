import os
import time
import logging
from typing import List, Dict, Optional
from dotenv import load_dotenv

# LangChain imports
from langchain_community.document_loaders import TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain.callbacks import get_openai_callback
from langchain.embeddings.base import Embeddings
from openai import OpenAI
from langchain_community.document_loaders import PyPDFLoader, PyMuPDFLoader, PDFMinerLoader
import pymupdf

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
        
        logger.info("Nebius AI Studio initialized with Meta-Llama-3.1-8B-Instruct")
        
        # Optimized Llama 3.1 prompt template
        self.prompt_template = """<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are BizBot Nigeria, an AI assistant specializing in Nigerian business regulations and procedures. You provide accurate, step-by-step guidance based on official government sources.

Core Guidelines:
- Answer ONLY based on the provided context
- If information is missing, clearly state "This information is not available in my current knowledge base"
- Include specific requirements, fees, timelines, and contact details
- Reference Nigerian agencies: CAC, FIRS, CBN
- Provide actionable steps in numbered lists when appropriate
- Be professional and precise
<|eot_id|>

<|start_header_id|>user<|end_header_id|>
Nigerian Business Context:
{context}

Question: {question}
<|eot_id|>

<|start_header_id|>assistant<|end_header_id|>"""


    # -------------------------------
    # Knowledge Base Setup
    # -------------------------------

    def setup_knowledge_base(self, documents_path: str = "data/scraped_content/business_knowledge_base.txt"):
        """Setup knowledge base optimized for Llama 3.1"""
        try:
            start_time = time.time()
            
            # Load documents
            if os.path.exists(documents_path):
                documents = ImprovedPDFLoader.load_pdf(r"docs\Nigerian Business FAQs.pdf", preferred_method="pymupdf")
                logger.info(f"Loaded documents from {documents_path}")
            else:
                documents = self._create_nigerian_business_data()
                logger.info("Using comprehensive sample Nigerian business data")
            
            # Text splitting
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
            
            # Setup QA chain
            prompt = PromptTemplate(
                template=self.prompt_template,
                input_variables=["context", "question"]
            )
            
            self.qa_chain = RetrievalQA.from_chain_type(
                llm=self.llm,
                chain_type="stuff",
                retriever=self.vector_store.as_retriever(
                    search_type="mmr",
                    search_kwargs={"k": 4, "fetch_k": 12, "lambda_mult": 0.7}
                ),
                chain_type_kwargs={"prompt": prompt},
                return_source_documents=True
            )
            
            setup_time = time.time() - start_time
            logger.info(f"Knowledge base setup completed in {setup_time:.2f}s")
            
        except Exception as e:
            logger.error(f"Setup error: {e}")
            raise e

    def query(self, question: str) -> Dict:
        """Query the Nigerian business knowledge base"""
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
            # Process query and track cost
            with get_openai_callback() as cb:
                result = self.qa_chain({"query": question})
                query_cost = cb.total_cost
                self.total_cost += query_cost
                
            # Extract and process sources
            sources = []
            confidence_score = 0.0
                
            if 'source_documents' in result:
                sources = [
                    {
                        "source": doc.metadata.get('source', 'Nigerian Business Database'),
                        "excerpt": doc.page_content[:120] + "..."
                    }
                    for doc in result['source_documents']
                ]
                    
                # Calculate confidence based on content relevance
                confidence_score = self._calculate_confidence(result['source_documents'], question)
                
            response_time = time.time() - start_time
                
            # Log query metrics
            logger.info(
                f"Query #{self.query_count} | "
                f"Time: {response_time:.2f}s | "
                f"Cost: ${query_cost:.4f} | "
                f"Confidence: {self._get_confidence_level(confidence_score)}"
            )
                
            return {
                "answer": result['result'],
                "sources": sources,
                "confidence": self._get_confidence_level(confidence_score),
                "confidence_score": round(confidence_score, 2),
                "cost": round(query_cost, 4),
                "response_time": round(response_time, 2)
            }
                
        except Exception as e:
            logger.error(f"Query error: {e}")
            return {
                "answer": f"I encountered an error processing your question. Please try again or rephrase your question. Error: {str(e)}",
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
            "status": "active"
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
