class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.model = 'gemini-2.5-flash';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  }

  async generateMeetingMinutes(meetingData) {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const prompt = this.buildPrompt(meetingData);
    
    console.log(`Using Gemini model: ${this.model}`);
    return await this.callGeminiAPI(this.model, prompt);
  }

  async callGeminiAPI(model, prompt) {
    const url = `${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
      throw new Error('No response generated from Gemini');
    }

    // Parse the JSON response from Gemini
    const parsedMinutes = this.parseGeminiResponse(generatedText);
    
    return {
      ...parsedMinutes,
      aiProcessing: {
        model: model,
        processedAt: new Date(),
        tokensUsed: data.usageMetadata?.totalTokenCount || 0,
        confidence: 0.85
      }
    };
  }

  buildPrompt(meetingData) {
    const { title, attendees, transcripts, duration, date } = meetingData;
    
    const attendeeList = attendees.map(a => `- ${a.name} (${a.email}) - ${a.role}`).join('\n');
    
    const transcriptText = transcripts.map(t => 
      `[${t.speakerName}] (${new Date(t.startTime).toLocaleTimeString()}): ${t.text}`
    ).join('\n');

    return `You are an expert meeting analyst. Analyze the following meeting transcript and generate comprehensive meeting minutes.

MEETING DETAILS:
- Title: ${title}
- Date: ${new Date(date).toLocaleDateString()}
- Duration: ${duration} minutes
- Attendees:
${attendeeList}

TRANSCRIPT:
${transcriptText || 'No transcript available - generate based on meeting metadata only.'}

Please analyze this meeting and provide a structured response in the following JSON format:
{
  "summary": "A comprehensive 2-3 paragraph summary of the meeting covering main topics discussed, key outcomes, and overall meeting effectiveness",
  "agenda": ["List of agenda items discussed or inferred from the conversation"],
  "discussionPoints": [
    {
      "topic": "Topic name",
      "summary": "Brief summary of what was discussed",
      "speakers": ["Names of people who contributed"]
    }
  ],
  "decisions": [
    {
      "description": "What was decided",
      "madeBy": "Person who made or proposed the decision"
    }
  ],
  "actionItems": [
    {
      "description": "What needs to be done",
      "assigneeName": "Person responsible (if mentioned)",
      "deadline": "Deadline if mentioned (ISO date format or null)",
      "priority": "low/medium/high based on context"
    }
  ],
  "highlights": ["Key moments or important statements from the meeting"],
  "questionsRaised": [
    {
      "question": "Question that was asked",
      "askedBy": "Person who asked",
      "answer": "Answer if provided",
      "answeredBy": "Person who answered"
    }
  ],
  "followUps": [
    {
      "description": "Follow-up item",
      "responsible": "Person responsible",
      "dueDate": "Due date if mentioned (ISO format or null)"
    }
  ]
}

IMPORTANT:
- Extract speaker names accurately from the transcript
- Identify action items and try to assign them to specific people based on context
- Infer priorities based on urgency words used
- If information is not available, use empty arrays or null values
- Ensure the JSON is valid and properly formatted
- Be thorough but concise in summaries

Respond ONLY with the JSON object, no additional text.`;
  }

  parseGeminiResponse(responseText) {
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanedResponse = responseText.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.slice(7);
      }
      if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.slice(3);
      }
      if (cleanedResponse.endsWith('```')) {
        cleanedResponse = cleanedResponse.slice(0, -3);
      }
      cleanedResponse = cleanedResponse.trim();

      const parsed = JSON.parse(cleanedResponse);
      
      return {
        summary: parsed.summary || '',
        agenda: parsed.agenda || [],
        discussionPoints: parsed.discussionPoints || [],
        decisions: parsed.decisions || [],
        actionItems: (parsed.actionItems || []).map(item => ({
          description: item.description,
          assigneeName: item.assigneeName || 'Unassigned',
          deadline: item.deadline ? new Date(item.deadline) : null,
          priority: item.priority || 'medium',
          status: 'pending'
        })),
        highlights: parsed.highlights || [],
        questionsRaised: parsed.questionsRaised || [],
        followUps: (parsed.followUps || []).map(item => ({
          description: item.description,
          responsible: item.responsible || 'TBD',
          dueDate: item.dueDate ? new Date(item.dueDate) : null
        }))
      };
    } catch (error) {
      console.error('Error parsing Gemini response:', error);
      console.error('Raw response:', responseText);
      
      // Return a basic structure if parsing fails
      return {
        summary: 'Meeting minutes could not be fully processed. Please review the recording.',
        agenda: [],
        discussionPoints: [],
        decisions: [],
        actionItems: [],
        highlights: [],
        questionsRaised: [],
        followUps: []
      };
    }
  }
}

module.exports = new GeminiService();
