import axios, { AxiosRequestConfig } from 'axios';
import { request } from 'http';
import { Agent } from 'https';
import { HttpAuthenticationChallangeParser } from './HttpAuthenticationChallangeParser';
import { HttpAuthenticationType } from './HttpAuthenticationType';

export default class Registry {
  static async validate(registryUrl: URL, username: string, password: string, ignoreSslErrors: Boolean = false, registryVersion: string = "v2"): Promise<Boolean> {
    let url = `${registryUrl.protocol}//${registryUrl.host}/${registryVersion}/`;

    const requestOptions = <AxiosRequestConfig>{
      validateStatus: () => true,
    }

    if (ignoreSslErrors) {
      requestOptions.httpsAgent = new Agent({ rejectUnauthorized: false })
    }

    // Initial connection to check for Authentication endpoint
    const initialResponse = await axios.get(url, requestOptions);
    if (initialResponse.status !== 401) {
      if (registryVersion === "v2") {
        console.warn("Did not receive authentication challange, will try with v1")
        return this.validate(registryUrl, username, password, ignoreSslErrors, "v1")
      }

      return false
    }

    if (!initialResponse.headers['www-authenticate']) {
      console.error("Could not find www-authenticate header in the docker registry auth request");
      console.debug(initialResponse.headers)
      return false;
    }

    const authenticateHeader = initialResponse.headers['www-authenticate']
    const authenticationChallange = HttpAuthenticationChallangeParser.parse(authenticateHeader)
    let authResponse;

    switch (authenticationChallange.type) {
      case HttpAuthenticationType.Basic:
        authResponse = await axios.get(url, { auth: { username, password }, ...requestOptions })
        return authResponse.status === 200
      case HttpAuthenticationType.Bearer:
        const challangeUrl = authenticationChallange.realm + "?" + authenticationChallange.parameters.join("&")
        authResponse = await axios.get(challangeUrl, { auth: { username, password }, ...requestOptions })

        return authResponse.status === 200
      default:
        throw "We don't support authentication type: ${}"
    }
  }
}
