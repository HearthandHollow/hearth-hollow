"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  "General Carpentry",
  "Furniture Building",
  "Deck Repair/Building",
  "Fence Building",
  "Wall Repair",
  "Welding",
  "Installation",
  "Other",
];

const TIMELINES = [
  "ASAP",
  "1-2 weeks",
  "2-4 weeks",
  "1-2 months",
  "Flexible",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file
const MAX_TOTAL_SIZE = 20 * 1024 * 1024; // 20MB total

export default function RequestPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    category: "",
    location: "",
    timeline: "",
    description: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const validFiles: File[] = [];
      let totalSize = uploadedFiles.reduce((sum, f) => sum + f.size, 0);

      for (const file of newFiles) {
        // Check individual file size
        if (file.size > MAX_FILE_SIZE) {
          setError(`File "${file.name}" is too large. Max 5MB per file.`);
          continue;
        }

        // Check total size
        if (totalSize + file.size > MAX_TOTAL_SIZE) {
          setError(`Total file size exceeds 20MB limit.`);
          continue;
        }

        validFiles.push(file);
        totalSize += file.size;
      }

      setUploadedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getTotalFileSize = () => {
    return uploadedFiles.reduce((sum, f) => sum + f.size, 0);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Validate form (photos are optional)
      if (!formData.name || !formData.email || !formData.phone || !formData.category || !formData.description) {
        throw new Error("Please fill in all required fields");
      }

      // Check total file size before sending
      const totalSize = getTotalFileSize();
      if (totalSize > MAX_TOTAL_SIZE) {
        throw new Error(`Total file size (${formatFileSize(totalSize)}) exceeds 20MB limit. Please remove some files.`);
      }

      // Create FormData for multipart upload
      const data = new FormData();
      data.append("name", formData.name);
      data.append("email", formData.email);
      data.append("phone", formData.phone);
      data.append("category", formData.category);
      data.append("location", formData.location);
      data.append("timeline", formData.timeline);
      data.append("description", formData.description);

      uploadedFiles.forEach((file) => {
        data.append("files", file);
      });

      const response = await fetch("/api/requests", {
        method: "POST",
        body: data,
      });

      if (!response.ok) {
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || `Request failed: ${response.status}`);
        } catch (parseErr) {
          // If response isn't JSON, show status error
          if (response.status === 413) {
            throw new Error("Files are too large. Please reduce the number of images or their size.");
          }
          throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        }
      }

      const result = await response.json();
      router.push(`/confirmation/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-themeBg py-8 sm:py-12 px-3 sm:px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-4 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Request a Quote</h1>
        <p className="text-themeMuted mb-8">Tell us about your project</p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contact Info */}
          <div className="border-b pb-6">
            <h2 className="text-lg font-semibold mb-4">Your Contact Info</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                name="name"
                placeholder="Full Name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-themeBorder rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                required
              />
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-themeBorder rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                required
              />
              <input
                type="tel"
                name="phone"
                placeholder="Phone Number"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-themeBorder rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                required
              />
              <input
                type="text"
                name="location"
                placeholder="Project Location (City/Address)"
                value={formData.location}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-themeBorder rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {/* Project Details */}
          <div className="border-b pb-6">
            <h2 className="text-lg font-semibold mb-4">Project Details</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-themeBorder rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                required
              >
                <option value="">Select Service Category</option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <select
                name="timeline"
                value={formData.timeline}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-themeBorder rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">Desired Timeline</option>
                {TIMELINES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <textarea
              name="description"
              placeholder="Describe your project in detail (what needs to be done, materials, preferences, etc.)"
              value={formData.description}
              onChange={handleInputChange}
              rows={5}
              className="w-full mt-4 px-4 py-2 border border-themeBorder rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>

          {/* File Upload */}
          <div className="border-b pb-6">
            <h2 className="text-lg font-semibold mb-4">Upload Photos <span className="text-sm font-normal text-themeMuted">(Optional)</span></h2>
            <p className="text-sm text-themeMuted mb-3">Max 5MB per file, 20MB total</p>
            <div className="border-2 border-dashed border-themeBorder rounded-lg p-8 text-center cursor-pointer hover:bg-themeBg transition">
              <input
                type="file"
                multiple
                accept="image/*,.heic,.heif"
                onChange={handleFileChange}
                className="hidden"
                id="file-input"
              />
              <label htmlFor="file-input" className="cursor-pointer">
                <div className="text-4xl mb-2">📸</div>
                <p className="font-semibold">Click to upload or drag and drop</p>
                <p className="text-sm text-themeMuted">PNG, JPG, HEIC, GIF</p>
              </label>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Uploaded Files ({uploadedFiles.length})</h3>
                <p className="text-sm text-themeMuted mb-2">Total size: {formatFileSize(getTotalFileSize())}</p>
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex justify-between items-center gap-3 bg-themeBg p-3 rounded">
                      <span className="text-sm text-themeMuted break-all min-w-0">{file.name} ({formatFileSize(file.size)})</span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-red-600 hover:text-red-700 font-semibold shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-white py-3 rounded-lg font-semibold hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? "Submitting..." : "Submit Request"}
          </button>
        </form>
      </div>
    </div>
  );
}
