const axios = require("axios");

async function callOllama(prompt, model = "deepseek-r1:1.5b") {
  try {
    const response = await axios.post("http://localhost:11434/api/generate", {
      model: model,
      prompt: prompt,
    });

    return response.data.response || "Error: No response from Ollama";
  } catch (error) {
    console.error("Ollama API error:", error);
    return "Oops! I couldn't reach the AI right now.";
  }
}
console.log(callOllama("Hello World!"));
