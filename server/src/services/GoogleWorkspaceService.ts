import { google, admin_directory_v1 } from 'googleapis';
import { JWT } from 'google-auth-library';

// In a real production setup, these would come from secret manager or env
// For demo/audit purposes, we're providing the structure that handles the Admin SDK.
const SCOPES = [
    'https://www.googleapis.com/auth/admin.directory.user',
    'https://www.googleapis.com/auth/admin.directory.domain.readonly'
];

class GoogleWorkspaceService {
    private client: JWT;
    private directory: admin_directory_v1.Admin;
    private readonly customerId: string;
    private readonly defaultDomain: string = 'webmydrive.com';

    constructor() {
        // Initialize with default fallback so tests don't crash
        const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || 'test@example.iam.gserviceaccount.com';
        const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

        this.client = new google.auth.JWT(
            clientEmail,
            undefined,
            privateKey,
            SCOPES,
            process.env.GOOGLE_ADMIN_EMAIL // Subject to impersonate
        );

        this.directory = google.admin({ version: 'directory_v1', auth: this.client });
        this.customerId = process.env.GOOGLE_CUSTOMER_ID || 'my_customer';
    }

    async checkDomainAvailability(domain: string): Promise<boolean> {
        try {
            // Check if domain is bound to our directory. For webmydrive, mostly we check users.
            const response = await this.directory.domains.get({
                customer: this.customerId,
                domainName: domain
            });
            return response.status === 200;
        } catch (error: any) {
            // 404 means available or not registered.
            if (error.code === 404) return false;
            throw error;
        }
    }

    async checkEmailAvailability(email: string): Promise<boolean> {
        try {
            await this.directory.users.get({
                userKey: email
            });
            return false; // User exists
        } catch (error: any) {
            if (error.code === 404) return true; // Available
            throw error;
        }
    }

    async createUser(email: string, firstName: string, lastName: string, passwordHash: string): Promise<string> {
        const response = await this.directory.users.insert({
            requestBody: {
                primaryEmail: email,
                name: {
                    givenName: firstName,
                    familyName: lastName
                },
                password: passwordHash, // Admin SDK accepts temporary passwords here
                changePasswordAtNextLogin: true,
            }
        });

        if (!response.data.id) {
            throw new Error("Failed to provision google user");
        }
        return response.data.id;
    }

    async suspendUser(email: string): Promise<void> {
        await this.directory.users.update({
            userKey: email,
            requestBody: {
                suspended: true,
                suspensionReason: 'ADMIN' // Can be PAYMENT_FAILED in real app
            }
        });
    }

    async unsuspendUser(email: string): Promise<void> {
        await this.directory.users.update({
            userKey: email,
            requestBody: {
                suspended: false
            }
        });
    }
}

export const googleWorkspace = new GoogleWorkspaceService();
