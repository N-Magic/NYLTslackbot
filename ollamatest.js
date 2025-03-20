const axios = require("axios");

async function callOllama(prompt, model = "deepseek-r1:1.5b") {
  try {
    const response = await axios({
      method: "post",
      url: "http://127.0.0.1:11434/api/generate",
      data: { model, prompt },
      responseType: "stream", // Handle streaming response
    });

    let fullResponse = "";
    return new Promise((resolve, reject) => {
      response.data.on("data", (chunk) => {
        try {
          const jsonChunk = JSON.parse(chunk.toString());
          if (jsonChunk.response) {
            fullResponse += jsonChunk.response;
          }
          if (jsonChunk.done) {
            resolve(fullResponse);
          }
        } catch (error) {
          console.error("JSON Parsing Error:", error);
          reject("Error processing AI response.");
        }
      });

      response.data.on("error", (error) => {
        reject("Ollama API Stream Error: " + error.message);
      });
    });
  } catch (error) {
    console.error("Ollama API error:", error.message);
    return "Oops! I couldn't reach the AI right now.";
  }
}

// Example usage
(async () => {
  const result = await callOllama("What is 3 plus 3");
  console.log("AI Response:", result);
})();
