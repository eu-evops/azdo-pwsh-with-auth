import { HttpAuthenticationType } from "./HttpAuthenticationType";

export interface HttpAuthenticationChallange {
  type: HttpAuthenticationType;
  realm: string;
  parameters: string[];
}
