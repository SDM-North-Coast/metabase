require("cypress-grep")();

import addContext from "mochawesome/addContext";
import "@testing-library/cypress/add-commands";
import "cypress-real-events/support";
import "@cypress/skip-test/support";
import "@percy/cypress";
import "./commands";

Cypress.on("uncaught:exception", (err, runnable) => false);

Cypress.on("test:after:run", (test, runnable) => {
  if (test.state === "failed") {
    const titleToFileName = title => title.replace(/[>]/g, "");
    let { parent } = runnable;
    let filename = "";
    // This while is to be able to support more than one level of parent in the screenshot name
    while (parent && parent.title) {
      filename = `${titleToFileName(parent.title)} -- ${filename}`;
      parent = parent.parent;
    }
    filename += `${titleToFileName(test.title)} (failed).png`;
    addContext(
      { test },
      {
        title: "Screenshot",
        value: `../../screenshots/${Cypress.spec.name}/${filename}`,
      },
    );
    addContext(
      { test },
      { title: "Video", value: `../../videos/${Cypress.spec.name}.mp4` },
    );
  }
});
