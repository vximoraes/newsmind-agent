export const typeDefs = `  
    type Source {  
    title: String!  
    url: String!  
    date: String!  
    }  

    type AgentResponse {  
    answer: String!  
    sources: [Source!]!  
    }  

    type Query {  
    _empty: String  
    }  

    type Mutation {  
    askAgent(query: String!): AgentResponse!  
    }  

    type Subscription {  
    agentStream(query: String!): AgentResponse!  
    }  
`;  