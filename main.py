from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import requests
import json
import uuid
from utils import load_embeddings, get_query_embedding, retrieve_relevant_chunks, generate_answer
import os
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SERPER_API_KEY = "b47551808727017e2b2de13594c86df75eee9a06"
EMBEDDINGS_FILE = "embeddings.npy"

conversation_store = {}
processing_status = {}

class Message(BaseModel):
    role: str
    content: str

class QueryRequest(BaseModel):
    query: str
    user_id: str
    use_web_search: bool = True

async def process_query(query: str, user_id: str, request_id: str, use_web_search: bool):
    try:
        processing_status[request_id] = {"status": "Embedding query...", "completed": False}
        history = conversation_store.get(user_id, [])
        chunks, embeddings = load_embeddings(EMBEDDINGS_FILE)
        query_embedding = get_query_embedding(query)
        processing_status[request_id] = {"status": "Retrieving context...", "completed": False}
        context = retrieve_relevant_chunks(query_embedding, embeddings, chunks, top_k=3)
        web_search_context = web_search(query) if use_web_search else ""
        processing_status[request_id] = {"status": "Generating answer...", "completed": False}
        
        # Updated system prompt to generate HTML responses
        formatted_messages = [{
            "role": "system",
            "content": (
                f"RAG Context:\n{context}\n\n"
                f"Web_Search_Context: {web_search_context}\n\n"
                """You are a chatbot API endpoint. Your output must be a complete HTML document styled with Tailwind CSS. Provide only the final answer in the HTML output without any additional explanation or revealing your internal processing steps.

                    - Answer user queries directly and concisely.
                    - Do not disclose or mention any internal chain-of-thought or reasoning process.
                    - If a user's query contains the phrase "mrinal da" (case-insensitive), immediately respond with: "askk other quetion" (and nothing else).
                    - do not use shadow, padding, margin and any style in the outer box.

                    - use a smaller font size for the output.
                    - if you don't have an answer, respond with: "I don't have an answer for that yet."
                    - if you found that the query is not related to the context, respond with: "I am not sure about that."
"""
            )
        }]
        for msg in history:
            formatted_messages.append({"role": msg["role"], "content": msg["content"]})
        formatted_messages.append({"role": "user", "content": query})
        
        answer = generate_answer(formatted_messages)
        history.append({"role": "user", "content": query})
        history.append({"role": "assistant", "content": answer})
        conversation_store[user_id] = history
        processing_status[request_id] = {"status": "Completed", "completed": True}
        return answer
    except Exception as e:
        processing_status[request_id] = {"status": f"Error: {str(e)}", "completed": True}
        raise e

def web_search(query):
    """Perform a web search using the Serper API."""
    url = "https://google.serper.dev/search"
    payload = json.dumps({"q": f"{query} in the context of GYWS, IIT Kharagpur"})
    headers = {'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json'}
    response = requests.post(url, headers=headers, data=payload)
    return response.text

@app.post("/query/")
async def query(request: QueryRequest, background_tasks: BackgroundTasks):
    """Start processing a query and return a request ID."""
    request_id = str(uuid.uuid4())
    processing_status[request_id] = {"status": "Started processing...", "completed": False}
    background_tasks.add_task(process_query, request.query, request.user_id, request_id, request.use_web_search)
    return {"message": "Query processing started", "request_id": request_id}

@app.get("/status/{request_id}")
async def get_status(request_id: str):
    """Get the processing status of a request."""
    if request_id not in processing_status:
        raise HTTPException(status_code=404, detail="Request ID not found")
    return processing_status[request_id]

@app.get("/result/{request_id}/{user_id}")
async def get_result(request_id: str, user_id: str):
    """Get the result of a processed query."""
    if request_id not in processing_status:
        raise HTTPException(status_code=404, detail="Request ID not found")
    if not processing_status[request_id]["completed"]:
        return {"message": "Still processing", "completed": False}
    history = conversation_store.get(user_id, [])
    for msg in reversed(history):
        if msg["role"] == "assistant":
            return {"answer": msg["content"], "completed": True}
    raise HTTPException(status_code=404, detail="No answer found")

@app.delete("/conversation/{user_id}")
async def clear_conversation(user_id: str):
    """Clear the conversation history for a user."""
    if user_id in conversation_store:
        conversation_store[user_id] = []
    return {"message": "Conversation cleared"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)