const axios = require("axios");

// Test the AI chat endpoint with different languages
const BASE_URL = "http://localhost:3000/api";
const AUTH_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzNWMzODU3MS0yZTQxLTRmMjQtOTU4Ni0xNzFjZDNiYmM5ZjIiLCJpYXQiOjE3NTc3NTg5NzAsImV4cCI6MTc1Nzg0NTM3MH0.zNSevlLOB6g_QxnRez9a0fBpZj3VUFtitSFZDUWhtYo";

const testCases = [
  {
    name: "English - fever",
    symptoms: "fever",
    language: "en",
  },
  {
    name: "Spanish - dolor de cabeza",
    symptoms: "dolor de cabeza",
    language: "es",
  },
  {
    name: "French - mal de tête",
    symptoms: "mal de tête",
    language: "fr",
  },
];

async function testLanguageSupport() {
  console.log("🌍 Testing AI Chat Language Support...\n");

  for (const testCase of testCases) {
    try {
      console.log(`📝 Testing: ${testCase.name}`);
      console.log(`Input: "${testCase.symptoms}" (${testCase.language})`);

      const response = await axios.post(
        `${BASE_URL}/ai-chat/process`,
        {
          symptoms: testCase.symptoms,
          language: testCase.language,
        },
        {
          headers: {
            Authorization: `Bearer ${AUTH_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("✅ Response:");
      console.log(JSON.stringify(response.data, null, 2));
      console.log("---\n");
    } catch (error) {
      console.log("❌ Error:");
      if (error.response) {
        console.log(`Status: ${error.response.status}`);
        console.log(
          `Message: ${
            error.response.data?.message || error.response.statusText
          }`
        );
      } else {
        console.log(error.message);
      }
      console.log("---\n");
    }
  }
}

testLanguageSupport();
