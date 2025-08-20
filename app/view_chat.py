import streamlit as st
import requests
import uuid

# Configure Streamlit
st.set_page_config(page_title="BizBot Nigeria", page_icon="🤖")

# Initialize session state
if "session_id" not in st.session_state:
    st.session_state.session_id = str(uuid.uuid4())
if "messages" not in st.session_state:
    st.session_state.messages = []

# App header
st.title("🤖 BizBot Nigeria")
st.subheader("Your AI Assistant for Nigerian Business Queries")

# Chat interface
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# User input
if prompt := st.chat_input("Ask me about Nigerian business regulations..."):
    # Add user message to chat history
    st.session_state.messages.append({"role": "user", "content": prompt})
    
    # Display user message
    with st.chat_message("user"):
        st.markdown(prompt)
    
    # Call API
    with st.chat_message("assistant"):
        with st.spinner("Thinking..."):
            try:
                response = requests.post(
                    "http://localhost:8000/chat",
                    json={
                        "message": prompt,
                        "session_id": st.session_state.session_id
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    bot_response = data.get("response", "")
                    sources = data.get("sources", [])
                    assistant_message = bot_response
                    if sources:
                        sources_text = "\n\n**Sources:**\n" + "\n".join(f"- {src}" for src in sources)
                        assistant_message += sources_text
                    st.markdown(assistant_message)
                else:
                    try:
                        error_json = response.json()
                        st.error(f"Error {response.status_code}: {error_json}")
                    except Exception:
                        st.error(f"Error {response.status_code}")
                        st.write("Raw response:", response.text)

            
            except requests.exceptions.ConnectionError:
                st.error("Cannot connect to the API. Make sure the server is running.")