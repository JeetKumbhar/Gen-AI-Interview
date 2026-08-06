const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY,
});

const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate's resume and self-description match the job description."),
    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview."),
        intention: z.string().describe("The intention of interviewer behind the technical question."),
        answer: z.string().describe("how to answer this question, what points to cover, what approach to take etc.")
    })).describe("Technical questions that can be asked in the interview, along with their intention and answer."),
    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The behavioral question can be asked in the interview."),
        intention: z.string().describe("The intention of interviewer behind the behavioral question."),
        answer: z.string().describe("how to answer this question, what points to cover, what approach to take etc.")
    })).describe("Behavioral questions that can be asked in the interview, along with their intention and answer."),
    skillGaps: z.array(z.object({   
        skill: z.string().describe("The skill that the candidate is lacking or needs improvement."),
        severity: z.enum(["low", "medium", "high"]).describe("The severity of the skill gap, indicating how critical it is for the candidate to improve this skill.")
    })).describe("Skill gaps that the candidate has, along with their severity."),
    preparationPlan: z.array(z.object({
        day: z.number().describe("The day number in the preparation plan, starting from 1."),
        focus: z.string().describe("The main focus or topic to be covered on this day, eg. Data Structures, System Design, etc."),
        tasks: z.array(z.string()).describe("A list of tasks or activities to be completed on this day to prepare for the interview, eg. solving problems, reading articles, watching videos, etc.")
    })).describe("A day-wise preparation plan for the candidate, outlining what to focus on and what tasks to complete each day.")
})

async function generateInterviewReport({resume, selfDescription, jobDescription}) {

    const prompt = `Generate an interview report for a candidate based on the following information:
        Resume: ${resume}
        Self Description: ${selfDescription}
        Job Description: ${jobDescription}`

    const schema = z.toJSONSchema(interviewReportSchema)

    const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseJsonSchema: schema
        }
    })

    const report = interviewReportSchema.parse(JSON.parse(response.text))
    console.log(JSON.stringify(report, null, 2))
    return report
}

module.exports = generateInterviewReport;
