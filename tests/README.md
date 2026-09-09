# Tests

Headless Playwright checks that drive `dispatch.html` over `file://` the way a
manager opens it. No launch flags.

```
NODE_PATH=$(npm root -g) node tests/route4me-template.test.js
```

`route4me-template.test.js` imports `fixtures/TEMPLATE_file01_Sage_export.csv`,
assigns crews the way `fixtures/TEMPLATE_file02_Route4Me_upload.csv` has them,
runs Export to Sage, and requires every row of the Route4Me upload to match the
template (the Service Time column, which the template lacks, is ignored).
Exit code 0 means every row matched.
