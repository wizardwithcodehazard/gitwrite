class GitHubService {
    constructor(token) {
        this.token = token;
        this.baseUrl = 'https://api.github.com';
    }

    async createOrUpdateFile(owner, repo, path, content, message, branch = 'main') {
        try {
            // First try to get the file to check if it exists
            let sha;
            try {
                const existing = await this.getFile(owner, repo, path, branch);
                sha = existing.sha;
            } catch (error) {
                // File doesn't exist, that's OK
            }

            const response = await fetch(
                `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message,
                        content: btoa(content),
                        branch,
                        sha
                    })
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message);
            }

            return await response.json();
        } catch (error) {
            console.error('GitHub API Error:', error);
            throw error;
        }
    }

    async getFile(owner, repo, path, branch = 'main') {
        const response = await fetch(
            `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
            {
                headers: {
                    'Authorization': `token ${this.token}`,
                }
            }
        );

        if (!response.ok) {
            throw new Error('File not found');
        }

        return await response.json();
    }
}