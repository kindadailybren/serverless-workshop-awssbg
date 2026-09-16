#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StatefulStack } from '../lib/stateful-stack';
import { StatelessStack } from '../lib/stateless-stack';
import { GlobalStack } from '../lib/global-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const statefulStack = new StatefulStack(app, 'StatefulStack', { env });

const statelessStack = new StatelessStack(app, 'StatelessStack', {
  env,
  table: statefulStack.table,
  assetsBucket: statefulStack.assetsBucket,
  userPool: statefulStack.userPool,
});
statelessStack.addDependency(statefulStack);

const globalStack = new GlobalStack(app, 'GlobalStack', {
  env,
  apiUrl: statelessStack.apiUrl,
  assetsBucketName: statefulStack.assetsBucket.bucketName,
});
globalStack.addDependency(statelessStack);
