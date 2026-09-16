import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME;

export const handler = async (event) => {
  console.log("PostConfirmation event received:", JSON.stringify(event, null, 2));

  try {
    const { triggerSource, request } = event;

    if (triggerSource === "PostConfirmation_ConfirmSignUp" || triggerSource === "PostConfirmation_ConfirmForgotPassword") {
      const userAttributes = request.userAttributes || {};
      const userId = userAttributes.sub;
      const email = userAttributes.email || "";
      const name = userAttributes.name || (email ? email.split("@")[0] : "New User");
      const timestamp = new Date().toISOString();

      const profileItem = {
        userId,
        name,
        email,
        bio: "",
        avatarKey: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await client.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: profileItem,
        })
      );

      console.log(`Successfully initialized profile for user ${userId} (${email})`);
    }
  } catch (err) {
    console.error("Error in PostConfirmation trigger:", err);
    // Even if saving to DB fails, do not throw an unhandled error that blocks confirmation in Cognito
  }

  // Cognito requires returning the event
  return event;
};
