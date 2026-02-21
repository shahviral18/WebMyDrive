import { useState } from "react";
import { Folder, FileText, Image, Search, Upload, Filter, List, Grid, Pencil, Download } from "lucide-react";
import UserLayout from "@/components/user/UserLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/contexts/UserContext";

export default function UserFiles() {
    const [view, setView] = useState<"list" | "grid">("list");
    const { files, addFile, renameFile } = useUser();

    const handleUpload = () => {
        addFile({
            id: Date.now(),
            name: `New Upload ${files.length + 1}.png`,
            type: "file",
            icon: Image,
            color: "text-primary",
            date: "Just now",
            size: "1.5 MB"
        });
    };

    const handleRename = (id: number, currentName: string) => {
        const newName = window.prompt("Enter new name:", currentName);
        if (newName) {
            renameFile(id, newName);
        }
    };

    return (
        <UserLayout>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <h1 className="text-2xl font-bold text-foreground">My Files</h1>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input placeholder="Search files..." className="pl-9 h-9" />
                        </div>
                        <div className="flex items-center gap-1 border rounded-lg p-1 bg-card">
                            <button
                                onClick={() => setView("list")}
                                className={`p-1.5 rounded ${view === "list" ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                <List className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setView("grid")}
                                className={`p-1.5 rounded ${view === "grid" ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                <Grid className="w-4 h-4" />
                            </button>
                        </div>
                        <Button size="sm" onClick={handleUpload} className="bg-primary hover:bg-primary-dim gap-2">
                            <Upload className="w-4 h-4" /> Upload
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                    {view === "list" ? (
                        <div className="divide-y divide-border">
                            {files.map((file) => (
                                <div key={file.id} className="flex items-center gap-4 p-4 hover:bg-surface-2 transition-colors group">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${file.type === 'folder' ? 'bg-primary/10 text-primary' : 'bg-surface-2'}`}>
                                        {file.type === 'folder' ? (
                                            <Folder className="w-5 h-5 fill-current" />
                                        ) : (
                                            <file.icon className={`w-5 h-5 ${file.color || 'text-muted-foreground'}`} />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                                        <p className="text-xs text-muted-foreground">{file.date} • {file.size}</p>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-blue-600" onClick={() => handleRename(file.id, file.name)}>
                                            <Pencil className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-blue-600">
                                            <Download className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
                            {files.map((file) => (
                                <div key={file.id} className="group p-4 rounded-xl border border-border hover:border-blue-100 hover:bg-blue-50/50 transition-all cursor-pointer">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${file.type === 'folder' ? 'bg-primary/10 text-primary' : 'bg-card border border-border'}`}>
                                            {file.type === 'folder' ? (
                                                <Folder className="w-5 h-5 fill-current" />
                                            ) : (
                                                <file.icon className={`w-5 h-5 ${file.color || 'text-muted-foreground'}`} />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-blue-600" onClick={(e) => { e.stopPropagation(); handleRename(file.id, file.name); }}>
                                                <Pencil className="w-3 h-3" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-blue-600">
                                                <Download className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium text-foreground truncate mb-1">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">{file.size}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </UserLayout>
    );
}
