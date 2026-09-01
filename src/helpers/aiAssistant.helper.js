const axios = require('axios');
const AiVideo = require('../models/aiVideo.model');

// Basic internal heuristic for plumbing/work
function isWorkRelatedQuestion(question) {
  if (!question) return { isWorkRelated: false, searchQuery: '' };

  const qLower = question.toLowerCase();

  // List of keywords associated with plumbing, construction, maintenance, tools, etc.
  const plumbingKeywords = [
    'plumb',
    'pipe',
    'faucet',
    'sink',
    'toilet',
    'drain',
    'water heater',
    'pump',
    'valve',
    'leak',
    'pressure',
    'fitting',
    'installation',
    'repair',
    'maintenance',
    'tool',
    'equipment',
    'troubleshoot',
    'safety',
    'sewer',
    'clog',
    'wrench',
    'pvc',
    'copper',
    'solder',
    'caulk',
    'sealant',
    'garbage disposal',
    'install',
    'fix',
    'replace',
  ];

  let matchCount = 0;
  for (const kw of plumbingKeywords) {
    if (qLower.includes(kw)) {
      matchCount++;
    }
  }

  // Generate a search query by removing stop words
  const stopWords = [
    'how',
    'to',
    'do',
    'i',
    'what',
    'is',
    'a',
    'the',
    'an',
    'my',
    'can',
    'you',
    'help',
    'me',
    'with',
    'for',
  ];
  const words = qLower.split(/\s+/);
  const searchWords = words.filter(
    (w) => !stopWords.includes(w) && w.length > 2,
  );

  const searchQuery = searchWords.join(' ');

  // Require at least one strong keyword match for work-related
  const isWorkRelated = matchCount > 0;

  return { isWorkRelated, searchQuery };
}

async function searchAiVideo(searchQuery, userRole) {
  if (!searchQuery) return null;
  try {
    const queryWords = searchQuery.split(/\s+/);
    const regexConditions = queryWords.flatMap((word) => [
      { title: { $regex: word, $options: 'i' } },
      { description: { $regex: word, $options: 'i' } },
    ]);

    // Try finding for specific role first
    let matchedVideo = await AiVideo.findOne({
      $or: regexConditions,
      targetAudience: userRole,
    }).lean();

    // If not found, broaden search to any audience
    if (!matchedVideo) {
      matchedVideo = await AiVideo.findOne({
        $or: regexConditions,
      }).lean();
    }

    if (matchedVideo) {
      return {
        id: matchedVideo._id || matchedVideo.id,
        title: matchedVideo.title,
        videoUrl: matchedVideo.videoUrl,
        description: matchedVideo.description,
        thumbnail: matchedVideo.thumbnail,
        isYoutube: false,
      };
    }
  } catch (err) {
    console.error('[AI] Database search error:', err.message);
  }
  return null;
}

async function searchYouTubeVideo(searchQuery) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.log('[AI] YOUTUBE_API_KEY not found in environment.');
    return null;
  }

  try {
    const q = `${searchQuery} plumbing tutorial`;
    const response = await axios.get(
      'https://www.googleapis.com/youtube/v3/search',
      {
        params: {
          part: 'snippet',
          q: q,
          type: 'video',
          maxResults: 1,
          key: apiKey,
        },
      },
    );

    if (
      response.data &&
      response.data.items &&
      response.data.items.length > 0
    ) {
      const item = response.data.items[0];
      return {
        id: item.id.videoId,
        title: item.snippet.title,
        videoUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        description: item.snippet.description,
        thumbnail:
          item.snippet.thumbnails?.high?.url ||
          item.snippet.thumbnails?.default?.url,
        isYoutube: true,
      };
    }
  } catch (err) {
    console.error('[AI] YouTube search error:', err.message);
  }
  return null;
}

async function generateAIAnswer(
  question,
  isWorkRelated,
  mediaContext = null,
  mediaUrl = null,
) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.log('[AI] OPENAI_API_KEY not found. Using fallback text.');
    if (isWorkRelated) {
      return 'I have found a tutorial that may help with your plumbing question.';
    } else {
      return 'I am a plumbing assistant, but I can help you with basic questions as well. (Please configure OPENAI_API_KEY for full AI responses).';
    }
  }

  try {
    let systemPrompt = isWorkRelated
      ? 'You are a helpful plumbing assistant. Provide a brief, direct answer to the plumbing question. If you are showing a video tutorial, mention it briefly.'
      : "You are a helpful assistant. Provide a brief, direct answer to the user's general question.";

    let userContent;

    if (mediaContext === 'image' && mediaUrl) {
      systemPrompt =
        'You are an expert plumbing assistant with computer vision capabilities. Analyze the provided image of plumbing equipment, pipes, or fixtures carefully and identify any issues, leaks, parts, or damage. Provide helpful troubleshooting steps or explanations.';
      const textPrompt = question
        ? `[User question with uploaded image]: ${question}`
        : 'Please analyze this plumbing image, identify any problems or components shown, and explain how to fix or address them.';

      userContent = [
        { type: 'text', text: textPrompt },
        { type: 'image_url', image_url: { url: mediaUrl } },
      ];
    } else if (mediaContext === 'video') {
      systemPrompt =
        'You are a helpful plumbing assistant. Analyze the context of the uploaded plumbing video and provide guidance on what to check or how to address typical issues.';
      userContent = question
        ? `[User uploaded a video]: ${question}`
        : '[User uploaded a plumbing video without additional text.]';
    } else {
      userContent = question || 'Hello';
    }

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        max_tokens: 300,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data.choices[0].message.content.trim();
  } catch (err) {
    console.error(
      '[AI] OpenAI generation error:',
      err.response?.data?.error?.message || err.message,
    );
    return "I'm having trouble analyzing the image right now, but please see if the provided tutorial or information helps.";
  }
}

module.exports = {
  isWorkRelatedQuestion,
  searchAiVideo,
  searchYouTubeVideo,
  generateAIAnswer,
};
