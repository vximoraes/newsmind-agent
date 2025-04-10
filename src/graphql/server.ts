import { createServer } from 'http';
import { createYoga } from 'graphql-yoga';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';

const schema = makeExecutableSchema({
    typeDefs,
    resolvers
});

const yoga = createYoga({
    schema,
    graphiql: true
});

export const graphqlServer = createServer(yoga);

export function startGraphqlServer() {
    graphqlServer.listen(4000, () => {
        console.log('GraphQL Server running on http://localhost:4000/graphql');
    });
}  