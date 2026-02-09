import * as React from "react";
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { ArrowSquareOut, Buildings, CircleNotch, Copy, DotsThree, Eye } from "@phosphor-icons/react";
import type {
    ColumnDef} from "@tanstack/react-table";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { authClient } from "@/lib/auth-client";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Transaction {
    id: string;
    amount: number;
    currency: string;
    status: string;
    reference: string;
    referenceId?: string;
    userId?: string;
    paystackId?: string;
    createdAt: string | Date;
    plan?: string;
    metadata?: string;
    _orgName?: string; // Added by frontend for org transactions display
}

export default function TransactionsTable() {
    const [data, setData] = React.useState<Array<Transaction>>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedTransaction, setSelectedTransaction] = React.useState<Transaction | null>(null);

    const columns: Array<ColumnDef<Transaction>> = [
        {
            accessorKey: "reference",
            header: "Reference",
            cell: ({ row }: { row: any }) => {
                const reference = row.getValue("reference") as string;
                return (
                    <div className="flex items-center gap-2 group">
                        <code className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {reference.slice(0, 12)}...
                        </code>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(reference);
                            }}
                            className="p-1 hover:bg-primary/10 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Copy Reference"
                        >
                            <span className="text-primary"><Copy weight="duotone" size={12} /></span>
                        </button>
                    </div>
                );
            },
        },
        {
            accessorKey: "amount",
            header: "Amount",
            cell: ({ row }: { row: any }) => {
                const rawAmount = row.getValue("amount");
                const amount = parseFloat(rawAmount as string);
                if (isNaN(amount) || rawAmount === null || rawAmount === undefined) {
                    return <div className="font-medium text-muted-foreground">—</div>;
                }
                const currency = row.original.currency || "NGN"; // fallback
                const formatted = new Intl.NumberFormat("en-NG", {
                    style: "currency",
                    currency: currency,
                }).format(amount / 100);
                return <div className="font-medium">{formatted}</div>;
            },
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }: { row: any }) => {
                const status = row.getValue("status") as string;
                return (
                    <Badge
                        variant={
                            status === "success"
                                ? "default"
                                : status === "pending"
                                ? "secondary"
                                : "destructive"
                        }
                        className="capitalize"
                    >
                        {status}
                    </Badge>
                );
            },
        },
        {
            accessorKey: "referenceId",
            header: "Billed To",
            cell: ({ row }: { row: any }) => {
                const referenceId = row.original.referenceId;
                const userId = row.original.userId;
                
                // If referenceId equals userId or is empty, it's personal billing
                const isOrgBilling = referenceId && referenceId !== userId;
                
                if (isOrgBilling) {
                    const orgName = row.original._orgName;
                    return (
                        <div className="flex items-center gap-1.5">
                            <span className="text-blue-500"><Buildings weight="duotone" size={14} /></span>
                            <div className="flex flex-col">
                                <span className="text-xs font-medium text-blue-600">
                                    {orgName || "Organization"}
                                </span>
                                {!orgName && (
                                    <code className="font-mono text-[9px] text-muted-foreground truncate max-w-20" title={referenceId}>
                                        {referenceId?.slice(0, 8)}...
                                    </code>
                                )}
                            </div>
                        </div>
                    );
                }
                
                return (
                    <span className="text-xs text-muted-foreground">Personal</span>
                );
            },
        },
        {
            accessorKey: "createdAt",
            header: "Date",
            cell: ({ row }: { row: any }) => {
                const date = new Date(row.getValue("createdAt") as string);
                return (
                    <div className="flex flex-col">
                        <span>{date.toLocaleDateString()}</span>
                        <span className="text-xs text-muted-foreground">
                            {date.toLocaleTimeString()}
                        </span>
                    </div>
                );
            },
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }: { row: any }) => {
                const transaction = row.original;

                const copyReference = () => {
                    navigator.clipboard.writeText(transaction.reference);
                };

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <DotsThree weight="duotone" size={16} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => setSelectedTransaction(transaction)}>
                                    <span className="mr-2 text-muted-foreground"><Eye weight="duotone" size={16} /></span>
                                    View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={copyReference}>
                                    <span className="mr-2 text-muted-foreground"><Copy weight="duotone" size={16} /></span>
                                    Copy Reference
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                                <a
                                    href={
                                        transaction.paystackId
                                            ? `https://dashboard.paystack.com/#/transactions/${transaction.paystackId}/analytics`
                                            : `https://dashboard.paystack.com/#/transactions?q=${transaction.reference}`
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex w-full items-center"
                                >
                                    <span className="mr-2 text-muted-foreground"><ArrowSquareOut weight="duotone" size={16} /></span>
                                    View on Paystack
                                </a>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    React.useEffect(() => {
        async function fetchTransactions() {
            try {
                // Fetch personal transactions
                const personalRes = await authClient.paystack.transaction.list({
                    query: {},
                });
                
                let allTransactions: Array<Transaction> = [];
                
                if (personalRes.data?.transactions) {
                    allTransactions = [...personalRes.data.transactions];
                }
                
                // Fetch organization transactions
                try {
                    const orgsRes = await authClient.organization.list();
                    if (orgsRes.data && Array.isArray(orgsRes.data)) {
                        for (const org of orgsRes.data) {
                            try {
                                const orgRes = await authClient.paystack.transaction.list({
                                    query: { referenceId: org.id },
                                });
                                if (orgRes.data?.transactions) {
                                    // Add org name to transactions for display
                                    const orgTransactions = orgRes.data.transactions.map((t: Transaction) => ({
                                        ...t,
                                        _orgName: org.name, // Internal field for display
                                    }));
                                    allTransactions = [...allTransactions, ...orgTransactions];
                                }
                            } catch (e) {
                                console.error(`Failed to fetch transactions for org ${org.id}:`, e);
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to fetch organizations:", e);
                }
                
                // Sort all transactions by date (newest first)
                allTransactions.sort((a, b) => 
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                
                setData(allTransactions);
            } catch (error) {
                console.error("Failed to fetch transactions:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchTransactions();
    }, []);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center py-10">
                <div className="text-muted-foreground animate-spin"><CircleNotch weight="bold" size={32} /></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup: any) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header: any) => (
                                    <TableHead key={header.id}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  header.column.columnDef.header,
                                                  header.getContext(),
                                              )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.length ? (
                            table.getRowModel().rows.map((row: any) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                >
                                    {row.getVisibleCells().map((cell: any) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    No transactions found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog
                open={!!selectedTransaction}
                onOpenChange={(open) => !open && setSelectedTransaction(null)}
            >
                <DialogContent className="sm:max-w-106.25">
                    <DialogHeader>
                        <DialogTitle>Transaction Details</DialogTitle>
                    </DialogHeader>
                    {selectedTransaction && (
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1 bg-muted/50 p-3 rounded-lg border border-dashed">
                                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">Reference</span>
                                <div className="flex items-center justify-between gap-2">
                                    <code className="font-mono text-xs break-all">{selectedTransaction.reference}</code>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 shrink-0"
                                        onClick={() => navigator.clipboard.writeText(selectedTransaction.reference)}
                                    >
                                        <Copy weight="duotone" size={12} />
                                    </Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4 border-b pb-2">
                                <span className="text-sm font-medium text-muted-foreground">Amount</span>
                                <span className="col-span-3 text-right font-semibold">
                                    {(selectedTransaction.amount as unknown) != null && !isNaN(selectedTransaction.amount) 
                                        ? new Intl.NumberFormat("en-NG", {
                                            style: "currency",
                                            currency: selectedTransaction.currency || "NGN",
                                        }).format(selectedTransaction.amount / 100)
                                        : "—"}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4 border-b pb-2">
                                <span className="text-sm font-medium text-muted-foreground">Status</span>
                                <span className="col-span-3 text-right">
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                                        selectedTransaction.status === "success"
                                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                    }`}>
                                        {selectedTransaction.status}
                                    </span>
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4 border-b pb-2">
                                <span className="text-sm font-medium text-muted-foreground">Billed To</span>
                                <span className="col-span-3 text-right">
                                    {selectedTransaction.referenceId && selectedTransaction.referenceId !== selectedTransaction.userId ? (
                                        <span className="inline-flex items-center gap-1 text-blue-600">
                                            <Buildings weight="duotone" size={14} />
                                            <span className="text-xs font-medium">
                                                {(selectedTransaction as any)._orgName || "Organization"}
                                            </span>
                                            {!(selectedTransaction as any)._orgName && (
                                                <code className="font-mono text-[9px] text-muted-foreground ml-1">
                                                    {selectedTransaction.referenceId.slice(0, 12)}...
                                                </code>
                                            )}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">Personal Account</span>
                                    )}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4 border-b pb-2">
                                <span className="text-sm font-medium text-muted-foreground">Plan</span>
                                <span className="col-span-3 text-right capitalize text-sm">
                                    {selectedTransaction.plan || "One-time Payment"}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4 border-b pb-2">
                                <span className="text-sm font-medium text-muted-foreground">Date</span>
                                <span className="col-span-3 text-right text-sm">
                                    {new Date(selectedTransaction.createdAt).toLocaleString()}
                                </span>
                            </div>
                            {selectedTransaction.metadata && (
                                <div className="space-y-1">
                                    <span className="text-sm font-medium text-muted-foreground text-left block">Metadata</span>
                                    <pre className="mt-1 max-h-25 overflow-auto rounded-md bg-muted p-2 text-[10px]">
                                        {JSON.stringify(JSON.parse(selectedTransaction.metadata), null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
