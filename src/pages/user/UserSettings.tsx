import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { User, Lock, Bell, Loader2, Save } from "lucide-react";
import UserLayout from "@/components/user/UserLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@/components/ui/tabs";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export default function UserSettings() {
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("profile");
    const { user } = useUser();

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordLoading, setPasswordLoading] = useState(false);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error("New passwords do not match.");
            return;
        }
        if (newPassword.length < 8) {
            toast.error("New password must be at least 8 characters.");
            return;
        }
        setPasswordLoading(true);
        try {
            await api.post("/auth/change-password", {
                currentPassword,
                newPassword
            });
            toast.success("Password changed successfully!");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err: any) {
            toast.error(err.message || "Failed to change password");
        } finally {
            setPasswordLoading(false);
        }
    };

    return (
        <UserLayout>
            <div className="space-y-6 max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>

                <Tabs defaultValue="profile" className="w-full">
                    <TabsList className="mb-4 bg-surface-3 p-1 rounded-lg">
                        <TabsTrigger value="profile" className="gap-2 px-6 py-2">
                            <User className="w-4 h-4" /> Profile
                        </TabsTrigger>
                        <TabsTrigger value="security" className="gap-2 px-6 py-2">
                            <Lock className="w-4 h-4" /> Security
                        </TabsTrigger>
                        <TabsTrigger value="notifications" className="gap-2 px-6 py-2">
                            <Bell className="w-4 h-4" /> Notifications
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="profile" className="space-y-4">
                        <Card className="border-border shadow-sm">
                            <CardHeader>
                                <CardTitle>Personal Information</CardTitle>
                                <CardDescription>Your personal account details.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="firstName">First Name</Label>
                                        <Input
                                            id="firstName"
                                            value={user.firstName}
                                            readOnly
                                            className="bg-surface-2 text-muted-foreground"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="lastName">Last Name</Label>
                                        <Input
                                            id="lastName"
                                            value={user.lastName}
                                            readOnly
                                            className="bg-surface-2 text-muted-foreground"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email Address</Label>
                                    <Input id="email" value={user.email} readOnly className="bg-surface-2 text-muted-foreground" />
                                </div>
                                <div className="pt-2">
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Lock className="w-3 h-3" />
                                        Personal details are managed by your organization administrator.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="security" className="space-y-4">
                        <Card className="border-border shadow-sm">
                            <CardHeader>
                                <CardTitle>Password & Security</CardTitle>
                                <CardDescription>Manage your password and security settings.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <form onSubmit={handleChangePassword} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="currentPassword">Current Password</Label>
                                        <Input
                                            id="currentPassword"
                                            type="password"
                                            value={currentPassword}
                                            onChange={e => setCurrentPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="newPassword">New Password</Label>
                                        <Input
                                            id="newPassword"
                                            type="password"
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                                        <Input
                                            id="confirmPassword"
                                            type="password"
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <Button type="submit" variant="outline" className="w-full mt-2" disabled={passwordLoading}>
                                        {passwordLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                        Change Password
                                    </Button>
                                </form>

                                <Separator className="my-6" />

                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-medium text-foreground">Two-Factor Authentication</h4>
                                        <p className="text-xs text-muted-foreground">Add an extra layer of security to your account.</p>
                                    </div>
                                    <Switch />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="notifications" className="space-y-4">
                        <Card className="border-border shadow-sm">
                            <CardHeader>
                                <CardTitle>Notification Preferences</CardTitle>
                                <CardDescription>Choose what updates you want to receive.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <h4 className="text-sm font-medium text-foreground">Email Notifications</h4>
                                        <p className="text-xs text-muted-foreground">Receive emails about your account activity.</p>
                                    </div>
                                    <Switch defaultChecked />
                                </div>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <h4 className="text-sm font-medium text-foreground">Marketing Emails</h4>
                                        <p className="text-xs text-muted-foreground">Receive emails about new products, features, and more.</p>
                                    </div>
                                    <Switch />
                                </div>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <h4 className="text-sm font-medium text-foreground">Security Alerts</h4>
                                        <p className="text-xs text-muted-foreground">Get notified about suspicious login attempts.</p>
                                    </div>
                                    <Switch defaultChecked disabled />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </UserLayout>
    );
}
