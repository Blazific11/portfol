export class CodeExecutor {
  constructor({ editor, outputElement, execTimeElement, languageSelect, pythonURI, javaURI, fetchOptions = {} } = {}) {
    this.editor = editor;
    this.outputElement = outputElement;
    this.execTimeElement = execTimeElement;
    this.languageSelect = languageSelect;
    this.pythonURI = pythonURI;
    this.javaURI = javaURI;
    this.fetchOptions = fetchOptions;
  }

  async run() {
    const code = this.editor?.getValue?.() || '';
    const lang = this.languageSelect?.value || 'python';
    const outputDiv = this.outputElement;
    const execTimeSpan = this.execTimeElement;

    if (!outputDiv) {
      throw new Error('CodeExecutor requires an output element');
    }

    outputDiv.textContent = '⏳ Running...';
    if (execTimeSpan) execTimeSpan.textContent = '';

    const startTime = Date.now();
    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

    let localRunURL;
    let hostedRunURL;
    if (lang === 'python') {
      localRunURL = `${this.pythonURI}/run/python`;
      hostedRunURL = 'https://flask.opencodingsociety.com/run/python';
    } else if (lang === 'java') {
      localRunURL = `${this.javaURI}/run/java`;
      hostedRunURL = 'https://spring.opencodingsociety.com/run/java';
    } else if (lang === 'javascript') {
      localRunURL = `${this.pythonURI}/run/javascript`;
      hostedRunURL = 'https://flask.opencodingsociety.com/run/javascript';
    }
    else throw new Error(`Unsupported language: ${lang}`);

    const body = JSON.stringify({ code });
    const options = { ...this.fetchOptions, method: 'POST', body };
    const runURLs = isLocalhost ? [localRunURL, hostedRunURL] : [localRunURL];

    let lastError;
    for (const runURL of runURLs) {
      try {
        const res = await fetch(runURL, options);
        if (!res.ok) {
          throw new Error(`Runner returned ${res.status}`);
        }
        const result = await res.json();
        const output = result.output || '[no output]';

        if (lang === 'javascript' && output.includes("No such file or directory: 'node'")) {
          throw new Error('Node.js not available on backend');
        }

        outputDiv.textContent = output;
        if (execTimeSpan) {
          execTimeSpan.textContent = `⏱Execution time: ${Date.now() - startTime}ms`;
        }
        return;
      } catch (err) {
        lastError = err;
      }
    }

    if (lang === 'javascript' && isLocalhost) {
      this.runJavaScriptFallback(code, startTime);
    } else if (isLocalhost && (lang === 'python' || lang === 'java')) {
      await this.runJudge0Fallback(code, lang, startTime);
    } else {
      outputDiv.textContent = 'Error: ' + lastError.message;
      if (execTimeSpan) execTimeSpan.textContent = '';
    }
  }

  async runJudge0Fallback(code, lang, startTime) {
    const languageId = lang === 'python' ? 71 : 62;
    const outputDiv = this.outputElement;
    const execTimeSpan = this.execTimeElement;

    try {
      const response = await fetch('https://ce.judge0.com/submissions?base64_encoded=false&wait=true', {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language_id: languageId,
          source_code: code,
        }),
      });

      if (!response.ok) {
        throw new Error(`Fallback runner returned ${response.status}`);
      }

      const result = await response.json();
      const output = [result.stdout, result.stderr, result.compile_output, result.message]
        .filter(Boolean)
        .join('\n') || '[no output]';
      outputDiv.textContent = output;
      if (execTimeSpan) {
        execTimeSpan.textContent = `⏱Execution time: ${Date.now() - startTime}ms (Judge0 fallback)`;
      }
    } catch (error) {
      outputDiv.textContent = 'Error: ' + error.message;
      if (execTimeSpan) execTimeSpan.textContent = '';
    }
  }

  runJavaScriptFallback(code, startTime) {
    const outputDiv = this.outputElement;
    const execTimeSpan = this.execTimeElement;

    try {
      const logs = [];
      const originalLog = console.log;
      console.log = function(...args) {
        logs.push(args.map(arg => String(arg)).join(' '));
        originalLog.apply(console, args);
      };

      eval(code);
      console.log = originalLog;

      outputDiv.textContent = logs.length > 0 ? logs.join('\n') : '[no output]';
      if (execTimeSpan) {
        execTimeSpan.textContent = `⏱Execution time: ${Date.now() - startTime}ms (local fallback)`;
      }
    } catch (evalErr) {
      outputDiv.textContent = 'Error: ' + evalErr.message;
      if (execTimeSpan) execTimeSpan.textContent = '';
    }
  }

  bindCopyOutput(button) {
    if (!button || !this.outputElement) return;

    button.addEventListener('click', () => {
      const output = this.outputElement.textContent;
      const original = button.textContent;
      navigator.clipboard.writeText(output).then(() => {
        button.textContent = '✔';
        setTimeout(() => {
          button.textContent = original;
        }, 1200);
      });
    });
  }
}

export default CodeExecutor;
