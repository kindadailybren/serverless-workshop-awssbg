import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
};

export const handler = async (event) => {
  try {
    const claims = event.requestContext?.authorizer?.claims;
    const userId = claims?.sub;

    if (!userId) {
      return {
        statusCode: 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Unauthorized: Missing user identity" }),
      };
    }

    const result = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { userId },
      })
    );

    const timestamp = new Date().toISOString();
    const profile = result.Item || {
      userId,
      name: "",
      email: "",
      bio: "",
      avatarKey: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(profile),
    };
  } catch (err) {
    console.error("Error fetching profile:", err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
