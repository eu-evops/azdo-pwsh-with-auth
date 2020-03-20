import tl = require('azure-pipelines-task-lib/task');
import tr = require('azure-pipelines-task-lib/toolrunner');
import path = require('path');
import fs = require('fs');

async function runPowershell(script:string, filePath:string) {
    fs.writeFileSync(filePath, script, { encoding: 'utf8' });
    console.log('========================== Starting Command Output ===========================');
    let powershell = tl.tool(tl.which('pwsh') || tl.which('powershell') || tl.which('pwsh', true))
        .arg('-NoLogo')
        .arg('-NoProfile')
        .arg('-NonInteractive')
        .arg('-Command')
        .arg(`. '${filePath.replace("'", "''")}'`);
        
        let options = <tr.IExecOptions>{
            failOnStdErr: false,
            errStream: process.stdout, // Direct all output to STDOUT, otherwise the output may appear out
            outStream: process.stdout, // of order since Node buffers it's own STDOUT but not STDERR.
            ignoreReturnCode: true
        };

        let exitCode: number = await powershell.exec(options);
        // Fail on exit code.
        if (exitCode !== 0) {
            tl.setResult(tl.TaskResult.Failed, tl.loc('JS_ExitCode', exitCode));
        }
}

async function configureDockerConnection(dockerHostEndpoint:string, tempDirectory:string) {
    console.log("Setting authentation for Docker Host")
    const auth = tl.getEndpointAuthorization(dockerHostEndpoint, false)
    const dockerCerts = path.join(tempDirectory, "docker-certs");
    if(!fs.existsSync(dockerCerts)) {
        fs.mkdirSync(dockerCerts);
    }

    fs.writeFileSync(path.join(dockerCerts, "ca.pem"), auth?.parameters.cacert);
    fs.writeFileSync(path.join(dockerCerts, "cert.pem"), auth?.parameters.cert);
    fs.writeFileSync(path.join(dockerCerts, "key.pem"), auth?.parameters.key);

    process.env.DOCKER_HOST = tl.getEndpointUrl(dockerHostEndpoint, false);
    process.env.DOCKER_TLS_VERIFY = "true"
    process.env.DOCKER_CERT_PATH = dockerCerts;
}

async function run() {
    try {        
        let tempDirectory = tl.getVariable('agent.tempDirectory');

        if (!tempDirectory) {
            tl.setResult(tl.TaskResult.Failed, `Temp directory not defined`)
            return;
        }

        const azureHostEndpoint = tl.getInput("connectedServiceNameARM");
        const dockerHostEndpoint = tl.getInput("dockerHostEndpoint");

        if (dockerHostEndpoint) {
            configureDockerConnection(dockerHostEndpoint, tempDirectory);
        }

        let filePath = path.join(tempDirectory, 'Run-AzdoScript.ps1');
        const inputScript = tl.getInput("script");
        let authScript: String = "";

        if (azureHostEndpoint) {
            console.log("Got Azure service connection")
            const auth = tl.getEndpointAuthorization(azureHostEndpoint, false);
            
            authScript = `
            $pass = "${auth?.parameters.serviceprincipalkey}" | ConvertTo-SecureString -Force -AsPlainText
            $cred = New-Object System.Management.Automation.PSCredential ("${auth?.parameters.serviceprincipalid}", $pass)
            Login-AzAccount -Scope Process -ServicePrincipal -Credential $cred -Tenant ${auth?.parameters.tenantid}
            `
        }

        let script = `
            $ErrorActionPreference = "Stop";
            $ProgressPreference = "SilentlyContinue";
            ${authScript}
            ${inputScript}
        `;

        await runPowershell(script, filePath);
        await runPowershell("Clear-AzContext -Force", path.join(tempDirectory, "Clear-AzContext.ps1"));
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

run();