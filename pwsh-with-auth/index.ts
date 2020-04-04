import tl = require('azure-pipelines-task-lib/task');
import tr = require('azure-pipelines-task-lib/toolrunner');
import path = require('path');
import util = require('util');
import ServiceConnection from './Source/ServiceConnection';
import DockerHostServiceConnection from './Source/ServiceConnections/DockerHostServiceConnection';
import AzureServiceConnection from './Source/ServiceConnections/AzureServiceConnection';
import PowershellExecutor from './Source/PowershellExecutor';

const serviceConnections: Array<ServiceConnection> = new Array<ServiceConnection>();

function getProxyUri() {
    return tl.getVariable("agent.proxyurl");
}

async function run() {
    tl.setResourcePath(path.join( __dirname, 'task.json'));

    
    try {
        let tempDirectory = tl.getVariable('agent.tempDirectory');
        
        if (!tempDirectory) {
            tl.setResult(tl.TaskResult.Failed, "Agent Temp directory not defined")
            return;
        }
        
        tl.debug(util.format("taskWorkingFolder=%s", tempDirectory));

        const azureHostEndpoint = tl.getInput("connectedServiceNameARM");
        const dockerHostEndpoint = tl.getInput("dockerHostEndpoint");

        if (azureHostEndpoint) {
            const dockerHostServiceConnection = new AzureServiceConnection(tempDirectory, azureHostEndpoint);
            serviceConnections.push(dockerHostServiceConnection);
        }

        if (dockerHostEndpoint) {
            const dockerHostServiceConnection = new DockerHostServiceConnection(tempDirectory, dockerHostEndpoint);
            serviceConnections.push(dockerHostServiceConnection);
        }

        let filePath = path.join(tempDirectory, 'Run-AzdoScript.ps1');

        tl.debug('Reading script input')
        const inputScript = tl.getInput("script");

        tl.debug(util.format("Input script: %s", inputScript));

        let proxyUri = getProxyUri();
        let env:{[key: string]: string} = {};
        if(proxyUri) {
            env.HTTP_PROXY=proxyUri;
            env.HTTPS_PROXY=proxyUri;
        }

        let script = `$ErrorActionPreference = "Stop";\n`;
        script += `$ProgressPreference = "SilentlyContinue";\n`;
        script += `\n`;
        script += inputScript;

        for(let i=0; i<serviceConnections.length; i++) {
            await serviceConnections[i].setupAuth();
        }

        const executor = new PowershellExecutor(script, filePath, env);
        await executor.run();

    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    } finally {
        for(let i=serviceConnections.length - 1; i==0; i--) {
            await serviceConnections[i].cleanupAuth();
        }
    }
}

run();