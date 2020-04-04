import tl = require('azure-pipelines-task-lib/task');
import tr = require('azure-pipelines-task-lib/toolrunner');
import ServiceConnection from '../ServiceConnection'
import path = require('path');
import PowershellExecutor from '../PowershellExecutor';

export default class AzureServiceConnection implements ServiceConnection {
  private workingDirectory: string
  private endpointId: string
  private env: { [key:string]: string }

  constructor(workingDirectory: string, endpointId: string, env:{[key:string]: string} = {}) {
    this.workingDirectory = workingDirectory
    this.endpointId = endpointId
    this.env = env
  }

  async setupAuth(): Promise<void> {
    console.log("Got Azure service connection")

    const servicePrincipalKey = 
        tl.getEndpointAuthorizationParameter(this.endpointId, "serviceprincipalkey", false);
    const servicePrincipalId = 
        tl.getEndpointAuthorizationParameter(this.endpointId, "serviceprincipalid", false);
    const tenantId = 
        tl.getEndpointAuthorizationParameter(this.endpointId, "tenantId", false);

    let authScript = `Import-Module Az;\n`;
    authScript += `$pass = "${servicePrincipalKey}" | ConvertTo-SecureString -Force -AsPlainText;\n`;
    authScript += `$cred = New-Object System.Management.Automation.PSCredential ("${servicePrincipalId}", $pass);\n`;
    authScript += `Connect-AzAccount -Scope Process -ServicePrincipal -Credential $cred -Tenant ${tenantId};\n`;
    
    const scriptPath = path.join(this.workingDirectory, "Connect-Azure.ps1");
    const executor = new PowershellExecutor(authScript, scriptPath, this.env);
    await executor.run();
  }

  async cleanupAuth(): Promise<void> {
    const scriptPath = path.join(this.workingDirectory, "Disconnect-Azure.ps1");
    const executor = new PowershellExecutor("Clear-AzContext -Force", scriptPath, this.env);
    await executor.run();
  }
}