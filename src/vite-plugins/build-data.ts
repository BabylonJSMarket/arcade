import { exec } from "child_process";
import chokidar from "chokidar";

export default {
  name: "custom-watch-plugin",
  configureServer(server) {
    server.allowedHosts = ["localhost"];
    server.https = true;
    const watcher = chokidar.watch("./data");
    // console.log(watcher);
    // Run the script when changes are detected
    watcher.on("change", (path) => {
      console.log(`File ${path} has been changed`);
      exec("npm run games", (err, stdout) => {
        if (err) {
          console.error(`exec error: ${err}`);
          return;
        }
        console.log(`stdout: ${stdout}`);
        // Send reload command to the client
        server.ws.send({
          type: "full-reload",
        });
      });
    });
  },
};
