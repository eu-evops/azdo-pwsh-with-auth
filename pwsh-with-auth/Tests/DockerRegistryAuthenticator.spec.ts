import Registry from "../Source/Library/Docker/Registry"

import { createServer, Server, ServerResponse } from 'http'
import { createServer as createHttpsServer, Server as HttpsServer, ServerOptions } from 'https'
import Express, { Response } from 'express';
import { AddressInfo } from "net";
import pem from 'pem'

describe("DockerRegistryAuthenticator", () => {
  let serverAddress: URL;
  let server: Server;

  let handleBasicAuth = (authorizationHeader: string, res: Response) => {
    if (authorizationHeader.toLowerCase().indexOf('basic') !== 0) {
      res.status(400).send();
    }
    const base64Auth = authorizationHeader.replace(/^basic /i, "")
    const auth = Buffer.from(base64Auth, 'base64').toString()

    if (auth !== "admin:password") {
      return res.status(401).send();
    }

    return res.status(200).send();
  }

  const stopServer = () => {
    server.close()
  }

  const createTestServer = async (app: Express.Application, ssl: boolean) => {
    const listen = (server: Server, callback: Function) => {
      server.listen()
      let addressInfo = <AddressInfo>(server.address())
      serverAddress = new URL(`http${ssl ? 's' : ''}://127.0.0.1:${addressInfo.port}`);
      callback()
    }
    return new Promise((resolve) => {
      if (ssl) {
        pem.createCertificate(<pem.CertificateCreationOptions>{ days: 1, selfSigned: true }, (error, result) => {
          const options = <ServerOptions>{
            cert: result.certificate,
            key: result.clientKey,
          }
          server = createHttpsServer(options, app)
          listen(server, resolve);
        })
      } else {
        server = createServer(app);
        listen(server, resolve);
      }
    })
  }


  describe("Registry with Basic auth", () => {
    beforeEach(async () => {
      let app = Express();

      app.use("*", (req, res, next) => {
        next()
      })

      app.get('/v2/', (req, res) => {
        let authorizationHeader = req.header("authorization")
        if (authorizationHeader) {
          return handleBasicAuth(authorizationHeader, res);
        }

        res.setHeader('www-authenticate', 'Basic realm="Login with basic auth"');
        res.status(401)
          .send()
      })

      await createTestServer(app, false);
    })
    afterEach(stopServer)

    it("should successfully autheticate against v2 endpoint", async () => {
      var authResult = await Registry.validate(serverAddress, "admin", "password")
      expect(authResult).toBeTruthy();

    })
  })
  describe("Registry with Bearer auth", () => {
    afterEach(stopServer)

    it("should successfully autheticate against v2 endpoint", async () => {
      let app = Express();
      app.get('/v2/', (req, res) => {
        let authorizationHeader = req.header("authorization")
        if (authorizationHeader) {
          return handleBasicAuth(authorizationHeader, res);
        }

        res.setHeader('www-authenticate', `Bearer realm="${serverAddress}auth/token",service="registry",scope="read:write:pull"`);
        res.status(401)
          .send()
      })

      app.get('/auth/token/', (req, res) => {
        expect(req.query.scope).toEqual("read:write:pull")
        expect(req.query.service).toEqual("registry")

        res.status(200).send()
      })

      await createTestServer(app, false);

      var authResult = await Registry.validate(serverAddress, "admin", "password")
      expect(authResult).toBeTruthy();
    })
  })

  describe('Registry with self-signed SSL certificates', () => {
    afterEach(stopServer);

    it('should allow to connect when the flag is set', async () => {
      let app = Express();
      app.get('/v2/', (req, res) => {
        let authorizationHeader = req.header("authorization")
        if (authorizationHeader) {
          return handleBasicAuth(authorizationHeader, res);
        }

        res.setHeader('www-authenticate', `Bearer realm="${serverAddress}auth/token",service="registry",scope="read:write:pull"`);
        res.status(401)
          .send()
      })

      app.get('/auth/token/', (req, res) => {
        expect(req.query.scope).toEqual("read:write:pull")
        expect(req.query.service).toEqual("registry")

        res.status(200).send()
      })

      await createTestServer(app, true);

      var authResult = await Registry.validate(serverAddress, "admin", "password", true)
      expect(authResult).toBeTruthy();
    })
  })
})