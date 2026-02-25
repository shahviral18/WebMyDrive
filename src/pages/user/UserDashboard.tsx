import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from "recharts";
import {
    FileText,
    FileImage,
    Star,
    HardDrive,
    Copy
} from "lucide-react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import UserLayout from "@/components/user/UserLayout";
import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";
import { toast } from "sonner";

// Empty activity chart — will be populated from real API
const mockUsage: { name: string; usage: number }[] = [];

export default function UserDashboard() {
    const { user, files } = useUser();
    const [loading, setLoading] = useState(true);
    const [referralData, setReferralData] = useState<any>(null);

    const rawName = user.name || (user.email ? user.email.split("@")[0] : "User");
    const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

    useEffect(() => {
        api.get('/referral/dashboard')
            .then(data => setReferralData(data))
            .catch(console.error);

        setTimeout(() => setLoading(false), 400);
    }, []);

    return (
        <UserLayout>
            <div className="space-y-6">
                {/* Welcome Banner */}
                <div className="bg-primary rounded-xl p-6 text-white shadow-lg shadow-none">
                    <h1 className="text-2xl font-bold mb-2">Welcome back, {displayName}!</h1>
                    <p className="text-blue-100 mb-6 max-w-lg">
                        Your WebMyDrive workspace is ready. Manage your files and plan below.
                    </p>
                    <div className="flex gap-3">
                        <Link to="/user/plans" className="bg-card text-primary px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors">
                            Upgrade Plan
                        </Link>
                        <Link to="/user/files" className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-800 transition-colors border border-blue-500">
                            View Analytics
                        </Link>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Storage Used</CardTitle>
                            <HardDrive className="h-4 w-4 text-indigo-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">0 GB</div>
                            <Progress value={0} className="h-2 mt-3 bg-surface-3 [&>div]:bg-purple-500" />
                            <p className="text-xs text-muted-foreground mt-2">of — GB used</p>
                        </CardContent>
                    </Card>
                    <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Files</CardTitle>
                            <FileText className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">{files.length}</div>
                            <p className="text-xs text-muted-foreground mt-2">in your workspace</p>
                        </CardContent>
                    </Card>
                    <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Starred</CardTitle>
                            <Star className="h-4 w-4 text-warning" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">0</div>
                            <p className="text-xs text-muted-foreground mt-2">Quick access</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts & Recent Files */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="border-border shadow-sm col-span-1">
                        <CardHeader>
                            <CardTitle className="text-lg">Storage Activity</CardTitle>
                            <CardDescription>File upload activity over the last 7 days</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            {mockUsage.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No activity yet</div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={mockUsage}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                                        <YAxis fontSize={12} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                                        <Tooltip cursor={{ fill: 'hsl(var(--muted)/0.5)' }} contentStyle={{ backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: 'var(--shadow-card)' }} />
                                        <Bar dataKey="usage" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-sm col-span-1">
                        <CardHeader>
                            <CardTitle className="text-lg">Recent Files</CardTitle>
                            <CardDescription>Files you worked on recently</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {files.length === 0 ? (
                                <div className="p-6 text-sm text-muted-foreground text-center">No files yet. Upload your first file to get started.</div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {files.slice(0, 4).map(file => (
                                        <div key={file.id} className="flex items-center gap-4 p-4 hover:bg-surface-2 transition-colors">
                                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                <FileText className="w-5 h-5 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                                                <p className="text-xs text-muted-foreground">{file.size} • {file.date}</p>
                                            </div>
                                            <Button variant="ghost" size="sm" className="text-muted-foreground">View</Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Referral Section */}
                <Card className="border-border shadow-sm mt-6">
                    <CardHeader>
                        <CardTitle className="text-xl text-foreground flex items-center gap-2">
                            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                            My Referrals
                        </CardTitle>
                        <CardDescription className="text-muted-foreground">Earn credits towards your renewal for every friend you refer</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-4">
                            <p className="text-sm font-medium text-foreground mb-2">Your Referral Link:</p>
                            <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-md py-2 px-3">
                                <span className="text-sm font-mono text-muted-foreground flex-1 truncate">
                                    {window.location.origin}/ref/{user?.referralCode}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 py-0 px-2 text-muted-foreground hover:text-foreground hover:bg-surface-3"
                                    onClick={() => {
                                        navigator.clipboard.writeText(`${window.location.origin}/ref/${user?.referralCode}`)
                                        toast.success("Referral link copied to clipboard!");
                                    }}
                                >
                                    <Copy className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {referralData && referralData.totalReferrals > 0 ? (
                            <div className="py-4 flex gap-6 text-foreground border-t border-border">
                                <div>
                                    <div className="text-xl font-bold">{referralData.totalReferrals}</div>
                                    <div className="text-xs text-muted-foreground">Total Referrals</div>
                                </div>
                                <div>
                                    <div className="text-xl font-bold text-green-600">Rs {referralData.creditBalance?.toLocaleString() || 0}</div>
                                    <div className="text-xs text-muted-foreground">Wallet Balance</div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground py-4 border-t border-border">
                                No referrals yet. Share your code with friends to start earning!
                            </div>
                        )}
                        <div className="flex justify-end gap-3 mt-2 border-t border-border pt-4">
                            <Link to="/user/referrals">
                                <Button variant="outline" className="border-border text-foreground hover:bg-surface-2">View Referral History</Button>
                            </Link>
                            <Button
                                className="bg-primary hover:bg-blue-700 gap-2"
                                onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/ref/${user?.referralCode}`)
                                    toast.success("Referral link copied! Share it with a friend.");
                                }}
                            >
                                <Copy className="w-4 h-4" /> Copy Link
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </UserLayout>
    );
}
