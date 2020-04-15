import tl = require('azure-pipelines-task-lib/task');
import tr = require('azure-pipelines-task-lib/toolrunner');
import fs from 'fs';
import ServiceConnection, { SetupAuthResponse, ServiceConnectionBase } from '../ServiceConnection'
import path = require('path');
import PowershellExecutor from '../PowershellExecutor';

export default class AzureServiceConnection extends ServiceConnectionBase {
  
  constructor(workingFolder: string, endpointId: string, env:{[key:string]: string} = {}) {
    super(workingFolder, endpointId, env)
  }

  async setupAuth(): Promise<SetupAuthResponse> {
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
    
    const scriptPath = path.resolve(path.join(this.workingFolder, "Connect-Azure.ps1"));
    fs.writeFileSync(scriptPath, authScript, { encoding: 'utf-8' })

    return <SetupAuthResponse>{
      scripts: [scriptPath]
    }
  }

  async cleanupAuth(): Promise<void> {
    console.log("Cleaning up Azure host authentication");
    const scriptPath = path.join(this.workingFolder, "Disconnect-Azure.ps1");
    const executor = new PowershellExecutor("Clear-AzContext -Scope Process -Force", scriptPath, this.env);
    
    return executor.run();
  }
}