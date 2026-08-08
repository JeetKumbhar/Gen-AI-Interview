import axios from "axios"

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
    withCredentials: true
})

export async function generateInterviewReport({ jobDescription, selfDescription, resumeFile }) {
    try {
        const formData = new FormData()
        formData.append("jobDescription", jobDescription)
        formData.append("selfDescription", selfDescription)
        if (resumeFile) {
            formData.append("resume", resumeFile)
        }

        const response = await api.post("/api/interview/", formData, {
            headers: { "Content-Type": "multipart/form-data" }
        })

        return response.data
    } catch (err) {
        console.log(err)
    }
}

export async function getInterviewReportById(interviewId) {
    try {
        const response = await api.get(`/api/interview/report/${interviewId}`)
        return response.data
    } catch (err) {
        console.log(err)
    }
}

export async function getAllInterviewReports() {
    try {
        const response = await api.get("/api/interview/")
        return response.data
    } catch (err) {
        console.log(err)
    }
}

export async function generateResumePdf({ interviewReportId }) {
    try {
        const response = await api.post(`/api/interview/resume/pdf/${interviewReportId}`, null, {
            responseType: "blob"
        })
        return response.data
    } catch (err) {
        console.log(err)
    }
}