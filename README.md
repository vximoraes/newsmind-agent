# 📰 News Article Agent

A Node.js-based query-response application that integrates with a large language model (LLM) to create a Retrieval-Augmented Generation (RAG) system using a vector database. This application ingests news article links, extracts and cleans their content, and provides answers to user queries.

## Features

- **Data Ingestion**:
  - Real-time ingestion of news article links via Kafka.
  - Fallback support for CSV-based ingestion.
- **Content Extraction and Cleaning**:
  - Extracts HTML content from links and structures it into a clean format.
- **Vector Database**:
  - Integration with Pinecone for similarity searches and fast retrieval.
- **Query-Response Interface**:
  - A POST endpoint `/agent` for user queries.
  - Supports link-based queries and retrieves relevant context from articles.
- **GraphQL API**:
  - Implements a GraphQL API using Yoga for structured queries.
- **Optimizations**:
  - Langfuse integration for monitoring and debugging.
  - Response streaming for improved user experience.
- **Advanced Monitoring**:
  - Integrated Langfuse for tracing, monitoring, and analytics

## Use Cases
The system can answer queries such as:

- "Tell me the latest news about Justin Trudeau"
- "Tell me something interesting that happened in the last month"
- "What do you know about LA fires?"
- "Summarize this article: [insert link]"

## Technologies

- **Backend**: Node.js, Express, TypeScript
- **Vector Database**: Pinecone
- **LLM Integration**: Google Generative AI (Gemini)
- **GraphQL**: Yoga
- **Monitoring**: Langfuse
- **Containerization**: Docker

## Setup Instructions

### Prerequisites

- Node.js (v16+)
- Docker (optional, for containerized setup)
- Kafka (for real-time ingestion)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/vximoraes/newsmind-agent.git
cd newsmind-agent
```

2. Install dependencies:
```bash
npm install
```

3. Set environment variables:

Create a `.env` file in the root directory with the following variables:

```env
GOOGLE_API_KEY=your_google_api_key

PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=news-index

KAFKA_BROKER=your_kafka_broker
KAFKA_USERNAME=your_kafka_username
KAFKA_PASSWORD=your_kafka_password
KAFKA_TOPIC_NAME=news
KAFKA_GROUP_ID_PREFIX=test-task-

PORT=3000
```

4. Build the application:
```bash
npm run build
```

5. Start the application:
```bash
npm run start
```

6. Access the application:
  - Express server: http://localhost:3000/agent
  - GraphQL server: http://localhost:4000/graphql

## Docker Setup

### Using Docker Compose

1. Build and start the application using Docker Compose:
```bash
docker-compose up --build
```

2. Access the application:
  - Express server: http://localhost:3000/agent
  - GraphQL server: http://localhost:4000/graphql

3. To stop the application, use:
```bash
docker-compose down
```

## API Endpoints

POST ```http://localhost:3000/agent```

Request: 
```bash
{
  "query": "Tell me the latest news about Justin Trudeau"
}
```

Response: 
```bash
{
  "answer": "An answer from LLM example",
  "sources": [
    {
      "title": "What's the latest on Los Angeles wildfires and how did they start?",
      "url": "https://www.bbc.com/news/articles/clyxypryrnko",
      "date": "2025-01-21T13:17:36Z"
    }
  ]
}
```

GraphQL API
Access the GraphQL API at ```/graphql```

Example query:
```bash
{
  "query": "mutation($q: String!) { askAgent(query: $q) { answer sources { title url date } } }",
  "variables": {
    "q": "Summarize this article: https://nypost.com/2024/08/11/sports/the-posts-10-best-moments-of-the-2024-paris-olympics"
  }
}
```

## Design Decisions

1. Vector Database:
    - Pinecone was chosen for its robust support for similarity searches and scalability.
2. LLM Integration:
    - Google Generative AI (Gemini) was selected for its high-quality embeddings and content generation capabilities.
3. GraphQL:
    - Yoga was used to provide a structured and flexible API for querying the system.

## Optimization Strategies
- Cost/Token Usage:
    - Limited the number of relevant articles retrieved to reduce token usage.
    - Used embeddings for efficient similarity searches.
- Latency:
    - Cached embeddings for frequently queried articles.
    - Optimized database queries with filters and indexing.
- Quality:
    - Structured prompts to ensure high-quality responses.
    - Implemented fallback mechanisms for error handling.
 
## Bonus Features Implemented

- Structured Output: Formatted responses for easier interface integration
- GraphQL API with Yoga: GraphQL endpoint for more flexible queries
- Langfuse Monitoring: Detailed tracking of performance and quality
- Response Streaming: Enhanced user experience with incremental responses

My Langfuse Home Screen:
![Image](https://github.com/user-attachments/assets/c3949823-3537-4b4a-ae2a-de64188a0a89)
