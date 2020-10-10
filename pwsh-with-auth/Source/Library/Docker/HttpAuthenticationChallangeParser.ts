import { HttpAuthenticationChallange } from './HttpAuthenticationChallange';
import { HttpAuthenticationType } from './HttpAuthenticationType';

export class HttpAuthenticationChallangeParser {
  private static regexp = /(?<AuthType>.*?) realm=\"(?<Realm>[^\"]+)\",?(?<AuthParameters>.*)?/i;

  static parse(header: string): HttpAuthenticationChallange {
    const matchingResults = HttpAuthenticationChallangeParser.regexp.exec(header);

    if (!matchingResults) {
      throw `Could not parse authentication header: ${header}`;
    }

    const response = <HttpAuthenticationChallange><unknown>{
      realm: matchingResults.groups?.Realm,
      parameters: [],
    };

    if (matchingResults.groups?.AuthParameters) {
      response.parameters = matchingResults.groups.AuthParameters.replace(/"/g, '').split(/,\s*/) || []
    }

    if (matchingResults.groups?.AuthType === 'Basic') {
      response.type = HttpAuthenticationType.Basic;
    } else if (matchingResults.groups?.AuthType === 'Bearer') {
      response.type = HttpAuthenticationType.Bearer;
    } else {
      throw `Unknown authentication type: ${matchingResults.groups?.AuthType}`;
    }

    return response;
  }
}
