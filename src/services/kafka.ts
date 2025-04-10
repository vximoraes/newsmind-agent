import { Kafka } from 'kafkajs';
import { fetchArticleContent } from '../utils/articleUtils';
import { getEmbeddings } from './ai';
import { Article } from '../types/Article';

export async function consumeKafka(index: any) {
    const kafka = new Kafka({
        clientId: 'news-article-agent',
        brokers: [process.env.KAFKA_BROKER!],
        ssl: true,
        sasl: {
            mechanism: 'plain',
            username: process.env.KAFKA_USERNAME!,
            password: process.env.KAFKA_PASSWORD!
        }
    });

    const consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP_ID_PREFIX + 'news-consumer' });
    await consumer.connect();
    await consumer.subscribe({ topic: process.env.KAFKA_TOPIC_NAME!, fromBeginning: true });

    console.log("Kafka consumer connected and subscribed to topic:", process.env.KAFKA_TOPIC_NAME);

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const msgValue = message.value?.toString();
            if (!msgValue) {
                console.error("Received empty message");
                return;
            }
            try {
                const parsed = JSON.parse(msgValue);
                if (!parsed || !parsed.URL) {
                    console.error("Message is missing required field 'URL':", msgValue);
                    return;
                }

                const article: Article = {
                    title: parsed.Source || "Unknown Source",
                    url: parsed.URL,
                    content: '',
                    date: new Date().toISOString()
                };
                article.content = await fetchArticleContent(article.url);
                const textForEmbedding = `Title: ${article.title}\nContent: ${article.content}`;
                const embedding = await getEmbeddings(textForEmbedding);
                const vector = [{
                    id: `article-${article.url.slice(-40).replace(/[^a-zA-Z0-9]/g, '-')}`,
                    values: embedding,
                    metadata: {
                        title: article.title,
                        content: article.content,
                        url: article.url,
                        date: article.date
                    }
                }];

                await index.upsert(vector);
                console.log(`Article from ${article.title} ingested successfully via Kafka`);
            } catch (err) {
                console.error("Error processing Kafka message:", err);
            }
        }
    });
}  