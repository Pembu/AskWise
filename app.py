import os
import time

from dotenv import load_dotenv
from flask import Flask, render_template
from flask import request, jsonify, abort

from langchain_chroma import Chroma
from langchain_classic.chains import RetrievalQA
from langchain_cohere import ChatCohere, CohereEmbeddings
from langchain_core.prompts import ChatPromptTemplate

app = Flask(__name__)
# Load environment variables from the local .env file.
load_dotenv()


def load_db():
    """Load the Chroma knowledge base and retrieval QA chain."""
    try:
        # Create Cohere embeddings for the stored knowledge-base documents.
        embeddings = CohereEmbeddings(
            cohere_api_key=os.environ["COHERE_API_KEY"],
            model="embed-english-v3.0",
        )
        # Open the local Chroma database in the db directory.
        vectordb = Chroma(
            persist_directory="db",
            embedding_function=embeddings,
        )
        # Combine retrieved documents with Cohere to answer questions.
        qa = RetrievalQA.from_chain_type(
            llm=ChatCohere(
                cohere_api_key=os.environ["COHERE_API_KEY"],
                temperature=0,
            ),
            chain_type="stuff",
            retriever=vectordb.as_retriever(
                search_type="similarity",
                search_kwargs={"k": 2},
            ),
            return_source_documents=True,
        )
        return qa
    except Exception as error:
        print("Error initializing QA system:", error)
        return None


qa = load_db()

def answer_from_knowledgebase(message):
    """Return an answer generated from relevant knowledge-base documents."""
    if qa is None:
        return "The knowledge base is currently unavailable."

    message = message.strip()
    if not message:
        return "Please enter a question."

    started = time.perf_counter()

    try:
        # Ask the retrieval QA chain to answer the user's question.
        res = qa.invoke({"query": message})
        # Get the documents that support the generated answer.
        source_docs = res.get("source_documents", [])

        elapsed = time.perf_counter() - started
        print(
            f"Knowledge-base request completed in {elapsed:.2f}s",
            flush=True,
        )

        # Do not return an answer when no relevant documents were found.
        if not source_docs:
            return "No relevant knowledge found in the database."

        return res.get("result", "No answer was generated.")
    except Exception as error:
        # Return a user-friendly message if retrieval or generation fails.
        elapsed = time.perf_counter() - started
        print(
            f"Knowledge-base request failed after {elapsed:.2f}s: {error}",
            flush=True,
        )
        return "Sorry, I couldn't retrieve an answer."

def search_knowledgebase(message):
    """Return source documents relevant to a knowledge-base search."""
    try:
        # Retrieve documents relevant to the user's search query.
        res = qa.invoke({"query": message})
        source_docs = res.get("source_documents", [])

        if not source_docs:
            return "No sources found for your query."

        # Format each retrieved document so the user can identify its source.
        sources = ""
        for count, source in enumerate(source_docs, 1):
            sources += f"Source {count}\n{source.page_content}\n"
        return sources
    except Exception as error:
        print("Error during source retrieval:", error)
        return "Error retrieving sources."

# Generate a response with Cohere.
def answer_as_chatbot(message):
    # Create the chat prompt.
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful, concise assistant."),
        ("human", "{message}"),
    ])
    # Send the prompt to the Cohere model.
    response = (prompt | ChatCohere(
        cohere_api_key=os.environ["COHERE_API_KEY"]
    )).invoke({"message": message})
    return response.content

@app.route('/kbanswer', methods=['POST'])
def kbanswer():
    # Read the user's question and answer it from the knowledge base.
    message = request.json["message"]
    response_message = answer_from_knowledgebase(message)
    # Return the answer in the format expected by the frontend.
    return jsonify({"message": response_message}), 200

@app.route('/search', methods=['POST'])
def search():    
    # Search the knowledge base and return the matching source documents.
    message = request.json["message"]
    response_message = search_knowledgebase(message)
    return jsonify({"message": response_message}), 200

@app.route('/answer', methods=['POST'])
def answer():
    message = request.json['message']
    
    # Generate a response
    response_message = answer_as_chatbot(message)
    
    # Return the response as JSON
    return jsonify({'message': response_message}), 200

@app.route("/")
def index():
    return render_template("index.html", title="")

if __name__ == "__main__":
    app.run()
