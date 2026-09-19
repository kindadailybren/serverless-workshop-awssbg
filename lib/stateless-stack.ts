import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { IUserPool } from 'aws-cdk-lib/aws-cognito';
import {
  Function,
  Runtime,
  Code,
} from 'aws-cdk-lib/aws-lambda';
import {
  RestApi,
  LambdaIntegration,
  Cors,
  CognitoUserPoolsAuthorizer,
  AuthorizationType,
  ResponseType,
} from 'aws-cdk-lib/aws-apigateway';
import { CfnOutput } from 'aws-cdk-lib';
import * as path from 'path';

export interface StatelessStackProps extends cdk.StackProps {
  table: Table;
  assetsBucket: Bucket;
  userPool: IUserPool;
}

export class StatelessStack extends cdk.Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: StatelessStackProps) {
    super(scope, id, props);

    // --- Lambda Functions ---

    const getProfileFn = new Function(this, 'GetProfileFunction', {
      runtime: Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: Code.fromAsset(path.join(__dirname, '../lambda/get-profile')),
      environment: {
        TABLE_NAME: props.table.tableName,
      },
      description: 'Retrieves the authenticated user profile from DynamoDB',
    });

    const updateProfileFn = new Function(this, 'UpdateProfileFunction', {
      runtime: Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: Code.fromAsset(path.join(__dirname, '../lambda/update-profile')),
      environment: {
        TABLE_NAME: props.table.tableName,
      },
      description: 'Updates the authenticated user profile in DynamoDB',
    });

    const getUploadUrlFn = new Function(this, 'GetUploadUrlFunction', {
      runtime: Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: Code.fromAsset(path.join(__dirname, '../lambda/get-upload-url')),
      environment: {
        BUCKET_NAME: props.assetsBucket.bucketName,
        TABLE_NAME: props.table.tableName,
      },
      description: 'Generates a presigned S3 URL for profile picture upload',
    });

    // --- IAM Grants ---

    props.table.grantReadData(getProfileFn);
    props.table.grantWriteData(updateProfileFn);
    props.assetsBucket.grantPut(getUploadUrlFn);
    props.table.grantWriteData(getUploadUrlFn);

    // --- API Gateway ---

    const api = new RestApi(this, 'ProfileApi', {
      restApiName: 'ProfileApi',
      description: 'Serverless Profile Page API with Cognito Authentication',
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    // Return CORS headers on authorizer / API Gateway errors (4XX and 5XX)
    api.addGatewayResponse('Default4XX', {
      type: ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
        'Access-Control-Allow-Methods': "'GET,PUT,OPTIONS'",
      },
    });

    api.addGatewayResponse('Default5XX', {
      type: ResponseType.DEFAULT_5XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
        'Access-Control-Allow-Methods': "'GET,PUT,OPTIONS'",
      },
    });

    // --- Cognito Authorizer ---

    const authorizer = new CognitoUserPoolsAuthorizer(this, 'ProfileAuthorizer', {
      cognitoUserPools: [props.userPool],
      authorizerName: 'CognitoUserPoolAuthorizer',
    });

    const authMethodOptions = {
      authorizer,
      authorizationType: AuthorizationType.COGNITO,
      authorizationScopes: ['aws.cognito.signin.user.admin'],
    };

    // Protected Routes
    const profile = api.root.addResource('profile');
    profile.addMethod('GET', new LambdaIntegration(getProfileFn), authMethodOptions);
    profile.addMethod('PUT', new LambdaIntegration(updateProfileFn), authMethodOptions);

    const uploadUrl = profile.addResource('upload-url');
    uploadUrl.addMethod('GET', new LambdaIntegration(getUploadUrlFn), authMethodOptions);

    this.apiUrl = api.url;

    new CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });
  }
}
