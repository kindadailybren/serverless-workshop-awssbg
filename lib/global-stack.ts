import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket, BlockPublicAccess } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import {
  Distribution,
  ViewerProtocolPolicy,
  CachePolicy,
  AllowedMethods,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import * as path from 'path';
import * as fs from 'fs';

export interface GlobalStackProps extends cdk.StackProps {
  apiUrl: string;
  assetsBucketName: string;
}

export class GlobalStack extends cdk.Stack {
  public readonly frontendDomain: string;
  public readonly assetsDomain: string;

  constructor(scope: Construct, id: string, props: GlobalStackProps) {
    super(scope, id, props);

    // --- 1. Frontend S3 Bucket & Dedicated CloudFront Distribution ---

    const frontendBucket = new Bucket(this, 'FrontendBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const frontendOrigin = S3BucketOrigin.withOriginAccessControl(frontendBucket);

    const frontendDistribution = new Distribution(this, 'FrontendDistribution', {
      defaultRootObject: 'index.html',
      comment: 'Frontend SPA Distribution',
      defaultBehavior: {
        origin: frontendOrigin,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    this.frontendDomain = frontendDistribution.distributionDomainName;

    // --- 2. Assets S3 Bucket & Dedicated CloudFront Distribution ---

    const assetsBucket = Bucket.fromBucketName(
      this,
      'ImportedAssetsBucket',
      props.assetsBucketName
    );

    const assetsOrigin = S3BucketOrigin.withOriginAccessControl(assetsBucket);

    const assetsDistribution = new Distribution(this, 'AssetsDistribution', {
      comment: 'Assets Distribution for Profile Pictures',
      defaultBehavior: {
        origin: assetsOrigin,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
      },
    });

    this.assetsDomain = assetsDistribution.distributionDomainName;

    // --- 3. Deploy Frontend Build to Frontend S3 Bucket ---

    const frontendDistPath = path.join(__dirname, '../frontend/dist');

    if (fs.existsSync(frontendDistPath)) {
      new BucketDeployment(this, 'DeployFrontend', {
        sources: [Source.asset(frontendDistPath)],
        destinationBucket: frontendBucket,
        distribution: frontendDistribution,
        distributionPaths: ['/*'],
      });
    } else {
      cdk.Annotations.of(this).addWarning(
        'frontend/dist not found — skipping BucketDeployment. ' +
        'Run `cd frontend && npm run build` then re-deploy GlobalStack.'
      );
    }

    // --- Outputs ---

    new CfnOutput(this, 'FrontendUrl', {
      value: 'https://' + frontendDistribution.distributionDomainName,
      description: 'CloudFront URL for React SPA Frontend',
    });

    new CfnOutput(this, 'FrontendDistributionId', {
      value: frontendDistribution.distributionId,
      description: 'Frontend CloudFront Distribution ID',
    });

    new CfnOutput(this, 'AssetsUrl', {
      value: 'https://' + assetsDistribution.distributionDomainName,
      description: 'CloudFront URL for Assets / Profile Pictures',
    });

    new CfnOutput(this, 'AssetsDistributionId', {
      value: assetsDistribution.distributionId,
      description: 'Assets CloudFront Distribution ID',
    });
  }
}
