const { PDFParse } = require("pdf-parse");
const {generateInterviewReport, generateResumePdf} = require("../services/ai.service");
const interviewReportModel = require("../models/interviewReport.model");


async function generateInterviewReportController(req, res) {
    try {
        const { selfDescription = "", jobDescription = "" } = req.body || {};

        let resumeText = "";

        if (req.file && req.file.buffer) {
            const parser = new PDFParse({ data: req.file.buffer });
            const parsedResume = await parser.getText();
            resumeText = parsedResume.text || "";
            await parser.destroy();
        } else if (req.body && req.body.resume && req.body.resume !== "") {
            resumeText = req.body.resume;
        }

        if (!jobDescription.trim()) {
            return res.status(400).json({
                message: "Job description is required."
            });
        }

        if (!resumeText.trim() && !selfDescription.trim()) {
            return res.status(400).json({
                message: "Either a resume or self description is required."
            });
        }

        const interviewReportByAi = await generateInterviewReport({
            resume: resumeText,
            selfDescription,
            jobDescription
        });

        const interviewReport = new interviewReportModel({
            user: req.user.id,
            resume: resumeText || undefined,
            selfDescription,
            jobDescription,
            ...interviewReportByAi
        });

        await interviewReport.save();

        res.status(201).json({
            message: "Interview report generated successfully",
            interviewReport
        });
    } catch (error) {
        console.error("generateInterviewReportController error:", error);
        res.status(500).json({
            message: "Failed to generate interview report.",
            error: error.message
        });
    }
}
/**
 * @description Controller to get interview report by interviewId.
 */
async function getInterviewReportByIdController(req, res) {

    const { interviewId } = req.params

    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    res.status(200).json({
        message: "Interview report fetched successfully.",
        interviewReport
    })
}


/** 
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(req, res) {
    const interviewReports = await interviewReportModel.find({ user: req.user.id }).sort({ createdAt: -1 }).select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan")

    res.status(200).json({
        message: "Interview reports fetched successfully.",
        interviewReports
    })
}


/**
 * @description Controller to generate resume PDF based on user self description, resume and job description.
 */
async function generateResumePdfController(req, res) {
    try {
        const { interviewReportId } = req.params

        const interviewReport = await interviewReportModel.findById(interviewReportId)

        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview report not found."
            })
        }

        const { resume, jobDescription, selfDescription } = interviewReport

        const pdfBuffer = await generateResumePdf({ resume, jobDescription, selfDescription })

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
        })

        res.send(pdfBuffer)
    } catch (error) {
        console.error("generateResumePdfController error:", error)
        res.status(500).json({
            message: "Failed to generate resume PDF.",
            error: error.message
        })
    }
}

module.exports = {
    generateInterviewReportController,
    getInterviewReportByIdController,
    getAllInterviewReportsController,
    generateResumePdfController
}