"use client";

import { useEffect, useState } from "react";
import { Buildings, Check, Copy, Crown, Plus, Trash, UserCircle, Users } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Organization {
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
    metadata?: Record<string, unknown>;
}

interface Member {
    id: string;
    userId: string;
    organizationId: string;
    role: string;
    createdAt: Date;
    user?: {
        id: string;
        name: string;
        email: string;
    };
}

export default function OrganizationManager() {
    const [organizations, setOrganizations] = useState<Array<Organization>>([]);
    const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
    const [members, setMembers] = useState<Array<Member>>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Form state
    const [orgName, setOrgName] = useState("");
    const [orgSlug, setOrgSlug] = useState("");

    // Load organizations
    useEffect(() => {
        loadOrganizations();
    }, []);

    // Load members when active org changes
    useEffect(() => {
        if (activeOrg) {
            loadMembers(activeOrg.id);
        }
    }, [activeOrg]);

    async function loadOrganizations() {
        setLoading(true);
        try {
            const result = await authClient.organization.list();
            if (result.data) {
                setOrganizations(result.data as Array<Organization>);
                if (result.data.length > 0 && !activeOrg) {
                    setActiveOrg(result.data[0] as Organization);
                }
            }
        } catch (error) {
            console.error("Failed to load organizations:", error);
        } finally {
            setLoading(false);
        }
    }

    async function loadMembers(orgId: string) {
        try {
            // Set active org first
            await authClient.organization.setActive({ organizationId: orgId });
            const result = await authClient.organization.getFullOrganization();
            if (result.data?.members) {
                setMembers(result.data.members as Array<Member>);
            }
        } catch (error) {
            console.error("Failed to load members:", error);
        }
    }

    async function createOrganization(e: React.FormEvent) {
        e.preventDefault();
        if (!orgName.trim()) return;

        setCreating(true);
        try {
            const slug = orgSlug.trim() || orgName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
            const result = await authClient.organization.create({
                name: orgName.trim(),
                slug,
            });

            if (result.data) {
                await loadOrganizations();
                setActiveOrg(result.data as Organization);
                setOrgName("");
                setOrgSlug("");
                setShowCreateForm(false);
            }
        } catch (error: any) {
            console.error("Failed to create organization:", error);
            alert(error?.message || "Failed to create organization");
        } finally {
            setCreating(false);
        }
    }

    async function deleteOrganization(orgId: string) {
        if (!confirm("Are you sure you want to delete this organization?")) return;

        try {
            await authClient.organization.delete({ organizationId: orgId });
            if (activeOrg?.id === orgId) {
                setActiveOrg(null);
            }
            await loadOrganizations();
        } catch (error: any) {
            console.error("Failed to delete organization:", error);
            alert(error?.message || "Failed to delete organization");
        }
    }

    function copyOrgId(orgId: string) {
        navigator.clipboard.writeText(orgId);
        setCopiedId(orgId);
        setTimeout(() => setCopiedId(null), 2000);
    }

    function getRoleIcon(role: string) {
        switch (role) {
            case "owner":
                return <Crown weight="duotone" size={16} className="text-yellow-500" />;
            case "admin":
                return <UserCircle weight="duotone" size={16} className="text-blue-500" />;
            default:
                return <Users weight="duotone" size={16} className="text-gray-500" />;
        }
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-8">
                    <div className="animate-pulse text-muted-foreground">Loading organizations...</div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Create Organization Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Buildings weight="duotone" size={24} />
                                Organizations
                            </CardTitle>
                            <CardDescription>
                                Manage your organizations for team billing
                            </CardDescription>
                        </div>
                        <Button
                            onClick={() => setShowCreateForm(!showCreateForm)}
                            variant={showCreateForm ? "outline" : "default"}
                            size="sm"
                        >
                            <Plus weight="bold" size={16} className="mr-1" />
                            {showCreateForm ? "Cancel" : "New Organization"}
                        </Button>
                    </div>
                </CardHeader>

                {showCreateForm && (
                    <CardContent>
                        <form onSubmit={createOrganization} className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="orgName">Organization Name *</Label>
                                    <Input
                                        id="orgName"
                                        placeholder="My Company"
                                        value={orgName}
                                        onChange={(e) => setOrgName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="orgSlug">Slug (optional)</Label>
                                    <Input
                                        id="orgSlug"
                                        placeholder="my-company"
                                        value={orgSlug}
                                        onChange={(e) => setOrgSlug(e.target.value)}
                                    />
                                </div>
                            </div>
                            <Button type="submit" disabled={creating || !orgName.trim()}>
                                {creating ? "Creating..." : "Create Organization"}
                            </Button>
                        </form>
                    </CardContent>
                )}
            </Card>

            {/* Organizations List */}
            {organizations.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Buildings weight="duotone" size={48} className="text-muted-foreground mb-4" />
                        <p className="text-muted-foreground mb-2">No organizations yet</p>
                        <p className="text-sm text-muted-foreground">
                            Create an organization to enable team billing with referenceId
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {organizations.map((org) => (
                        <Card
                            key={org.id}
                            className={`cursor-pointer transition-all ${
                                activeOrg?.id === org.id
                                    ? "ring-2 ring-primary shadow-md"
                                    : "hover:shadow-sm"
                            }`}
                            onClick={() => setActiveOrg(org)}
                        >
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-lg">{org.name}</CardTitle>
                                        <CardDescription>/{org.slug}</CardDescription>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                copyOrgId(org.id);
                                            }}
                                            title="Copy Organization ID for billing"
                                        >
                                            {copiedId === org.id ? (
                                                <Check size={16} className="text-green-500" />
                                            ) : (
                                                <Copy size={16} />
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteOrganization(org.id);
                                            }}
                                            title="Delete organization"
                                        >
                                            <Trash size={16} />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xs text-muted-foreground space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">ID:</span>
                                        <code className="bg-muted px-1 rounded text-[10px]">
                                            {org.id}
                                        </code>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground/70">
                                        Use this ID as <code className="bg-muted px-1 rounded">referenceId</code> for org billing
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Active Organization Members */}
            {activeOrg && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Users weight="duotone" size={20} />
                            Members of {activeOrg.name}
                        </CardTitle>
                        <CardDescription>
                            Owners and admins can manage billing for this organization
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {members.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No members found</p>
                        ) : (
                            <div className="space-y-2">
                                {members.map((member) => (
                                    <div
                                        key={member.id}
                                        className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50"
                                    >
                                        <div className="flex items-center gap-3">
                                            {getRoleIcon(member.role)}
                                            <div>
                                                <p className="text-sm font-medium">
                                                    {member.user?.name || member.user?.email || "Unknown"}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {member.user?.email}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-medium capitalize px-2 py-1 rounded bg-background">
                                            {member.role}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Billing Info Card */}
            {activeOrg && (
                <Card className="bg-muted/30 border-dashed">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <Buildings weight="duotone" size={24} className="text-primary" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-medium">Organization Billing</p>
                                <p className="text-sm text-muted-foreground">
                                    To bill this organization, use the following referenceId:
                                </p>
                                <code className="inline-block mt-2 px-3 py-2 rounded-lg bg-background font-mono text-sm">
                                    referenceId: "{activeOrg.id}"
                                </code>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Choose a "team" or "enterprise" plan when subscribing to bill against this organization.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
