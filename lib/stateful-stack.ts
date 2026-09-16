import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  Table,
  AttributeType,
  BillingMode,
} from 'aws-cdk-lib/aws-dynamodb';
import {
  Bucket,
  BlockPublicAccess,
  HttpMethods,
} from 'aws-cdk-lib/aws-s3';
import {
  UserPool,
  UserPoolClient,
  UserPoolOperation,
  AccountRecovery,
} from 'aws-cdk-lib/aws-cognito';
import {
  Function,
  Runtime,
  Code,
} from 'aws-cdk-lib/aws-lambda';
import { RemovalPolicy, CfnOutput, aws_iam as iam } from 'aws-cdk-lib';
import * as path from 'path';

export class StatefulStack extends cdk.Stack {
  public readonly table: Table;
  public readonly assetsBucket: Bucket;
  public readonly userPool: UserPool;
  public readonly userPoolClient: UserPoolClient;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. DynamoDB table for user profiles
    this.table = new Table(this, 'ProfileTable', {
      tableName: 'ProfileTable',
      partitionKey: { name: 'userId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // 2. Cognito User Pool & Web Client
    this.userPool = new UserPool(this, 'UserPool', {
      userPoolName: 'WorkshopUserPool',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        fullname: {
          required: false,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.userPoolClient = new UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: 'WorkshopWebClient',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false, // Required false for SPA browser clients
    });

    // 3. Post-Confirmation Lambda trigger
    const postConfirmationFn = new Function(this, 'PostConfirmationFunction', {
      runtime: Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: Code.fromAsset(path.join(__dirname, '../lambda/post-confirmation')),
      environment: {
        TABLE_NAME: this.table.tableName,
      },
      description: 'Initializes user profile in DynamoDB upon Cognito confirmation',
    });

    this.table.grantWriteData(postConfirmationFn);
    this.userPool.addTrigger(UserPoolOperation.POST_CONFIRMATION, postConfirmationFn);

    // 4. S3 bucket for profile picture uploads
    this.assetsBucket = new Bucket(this, 'AssetsBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [HttpMethods.PUT, HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });

    // Allow CloudFront service principal in this account to read from assets bucket (via OAC)
    this.assetsBucket.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'AllowCloudFrontServicePrincipal',
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      actions: ['s3:GetObject'],
      resources: [this.assetsBucket.arnForObjects('*')],
      conditions: {
        StringEquals: {
          'AWS:SourceAccount': this.account,
        },
      },
    }));

    // Outputs
    new CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new CfnOutput(this, 'AssetsBucketName', {
      value: this.assetsBucket.bucketName,
      description: 'S3 bucket name for profile picture uploads',
    });
  }
}
