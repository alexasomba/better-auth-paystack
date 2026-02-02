"use client";

import * as React from "react";
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { authClient } from "@/lib/auth-client";
import { CircleNotch, DotsThree, Copy, ArrowSquareOut, Eye } from "@phosphor-icons/react";
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
    paystackId?: string;
    createdAt: string | Date;
    plan?: string;
    metadata?: string;
}

export default function TransactionsTable() {
    const [data, setData] = React.useState<Transaction[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedTransaction, setSelectedTransaction] = React.useState<Transaction | null>(null);

    const columns: ColumnDef<Transaction>[] = [
        {
            accessorKey: "reference",
            header: "Reference",
            cell: ({ row }) => {
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
                            <Copy weight="duotone" className="size-3 text-primary" />
                        </button>
                    </div>
                );
            },
        },
        {
            accessorKey: "amount",
            header: "Amount",
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("amount") as string);
                const currency = row.original.currency;
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
            cell: ({ row }) => {
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
            accessorKey: "createdAt",
            header: "Date",
            cell: ({ row }) => {
                const date = new Date(row.getValue("createdAt"));
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
            cell: ({ row }) => {
                const transaction = row.original;

                const copyReference = () => {
                    navigator.clipboard.writeText(transaction.reference);
                };

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <DotsThree weight="duotone" className="h-4 w-4" />
                                </Button>
                            }
                        />
                        <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => setSelectedTransaction(transaction)}>
                                    <Eye weight="duotone" className="mr-2 h-4 w-4 text-muted-foreground" />
                                    View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={copyReference}>
                                    <Copy weight="duotone" className="mr-2 h-4 w-4 text-muted-foreground" />
                                    Copy Reference
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                render={
                                    <a
                                        href={
                                            transaction.paystackId
                                                ? `https://dashboard.paystack.com/#/transactions/${transaction.paystackId}/analytics`
                                                : `https://dashboard.paystack.com/#/transactions?q=${transaction.reference}`
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex w-full items-center p-0"
                                    >
                                        <ArrowSquareOut weight="duotone" className="mr-2 h-4 w-4 text-muted-foreground" />
                                        View on Paystack
                                    </a>
                                }
                            />
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    React.useEffect(() => {
        async function fetchTransactions() {
            try {
                const res = await authClient.paystack.transaction.list({
                    query: {},
                });
                if (res.data?.transactions) {
                    setData(res.data.transactions);
                }
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
                <CircleNotch weight="bold" className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
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
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                >
                                    {row.getVisibleCells().map((cell) => (
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
                                        <Copy weight="duotone" className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4 border-b pb-2">
                                <span className="text-sm font-medium text-muted-foreground">Amount</span>
                                <span className="col-span-3 text-right font-semibold">
                                    {new Intl.NumberFormat("en-NG", {
                                        style: "currency",
                                        currency: selectedTransaction.currency,
                                    }).format(selectedTransaction.amount / 100)}
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
