import ServiceConnection, { SetupAuthResponse, ServiceConnectionBase } from '../ServiceConnection'
import path from 'path';
import fs from 'fs';
import tl = require('azure-pipelines-task-lib/task');
import * as yaml from 'js-yaml';

export default class KubernetesHostServiceConnection extends ServiceConnectionBase {
  static KUBECONFIG_FOLDER = "kubernetes";
  kubernetesConfigFolder: string

  constructor(workingFolder:string, endpointId: string, env: {[key:string]: string}) {
    super(workingFolder, endpointId, env);
    this.kubernetesConfigFolder = path.join(workingFolder, KubernetesHostServiceConnection.KUBECONFIG_FOLDER)
  }
  
  async setupAuth(): Promise<SetupAuthResponse> {
    console.log("Got Kubernetes service connection")

    const auth = tl.getEndpointAuthorization(this.endpointId, false)
    if (!auth) {
      throw new Error("Authentication not found for endpoint " + this.endpointId);
    }
    
    if(!fs.existsSync(this.kubernetesConfigFolder)) {
      fs.mkdirSync(this.kubernetesConfigFolder);
    }
    
    var authorizationType = tl.getEndpointDataParameter(this.endpointId, 'authorizationType', false);

    const kubeconfigPath = path.join(this.kubernetesConfigFolder, "config")
    let kubeconfig: string;

    if (authorizationType === "Kubeconfig") {
      kubeconfig = this.getKubeconfigForCluster(this.endpointId)
    } else {
      kubeconfig = this.createKubeconfig(this.endpointId)
    }

    fs.writeFileSync(kubeconfigPath, kubeconfig);

    return <SetupAuthResponse>{
      scripts: [],
      environment: {
        KUBECONFIG: kubeconfigPath
      }
    }
  }

createKubeconfig(kubernetesServiceEndpoint: string): string {
  const kubeconfigTemplateString = '{"apiVersion":"v1","kind":"Config","clusters":[{"cluster":{"certificate-authority-data": null,"server": null}}], "users":[{"user":{"token": null}}]}';
  const kubeconfigTemplate = JSON.parse(kubeconfigTemplateString);

  //populate server url, ca cert and token fields
  kubeconfigTemplate.clusters[0].cluster.server = tl.getEndpointUrl(kubernetesServiceEndpoint, false);
  kubeconfigTemplate.clusters[0].cluster['certificate-authority-data'] = tl.getEndpointAuthorizationParameter(kubernetesServiceEndpoint, 'serviceAccountCertificate', false);
  const base64ApiToken = Buffer.from(
    tl.getEndpointAuthorizationParameter(kubernetesServiceEndpoint, 'apiToken', false)!,
    'base64'
  );

  kubeconfigTemplate.users[0].user.token = base64ApiToken.toString();

  return JSON.stringify(kubeconfigTemplate);
}

getKubeconfigForCluster(kubernetesServiceEndpoint: string): string {
  const kubeconfig = tl.getEndpointAuthorizationParameter(kubernetesServiceEndpoint, 'kubeconfig', false)!;
  const clusterContext = tl.getEndpointAuthorizationParameter(kubernetesServiceEndpoint, 'clusterContext', true);
  if (!clusterContext) {
      return kubeconfig!;
  }

  const kubeconfigTemplate = yaml.safeLoad(kubeconfig);
  kubeconfigTemplate['current-context'] = clusterContext;
  const modifiedKubeConfig = yaml.safeDump(kubeconfigTemplate);
  return modifiedKubeConfig.toString();
}

  async cleanupAuth(): Promise<void> {
    console.log("Cleaning up Kubernetes host authentication");
    tl.rmRF(this.kubernetesConfigFolder);
  }
}