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
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
                    <button
                        onClick={() => setSelectedTransaction(row.original)}
                        className="font-mono text-xs text-primary hover:underline cursor-pointer"
                    >
                        {reference.slice(0, 12)}...
                    </button>
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
                    <div
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                            status === "success"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : status === "pending"
                                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        }`}
                    >
                        {status}
                    </div>
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
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setSelectedTransaction(transaction)}>
                                <Eye weight="duotone" className="mr-2 h-4 w-4 text-muted-foreground" />
                                View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={copyReference}>
                                <Copy weight="duotone" className="mr-2 h-4 w-4 text-muted-foreground" />
                                Copy Reference
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                render={
                                    <a
                                        href={`https://dashboard.paystack.com/#/transactions/${transaction.reference}`}
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
                // @ts-expect-error - types might not be fully synchronized yet
                const res = await authClient.paystack.transaction.list();
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
                        <DialogDescription>
                            Detailed information for reference:{" "}
                            <span className="font-mono text-[10px] break-all block mt-1">{selectedTransaction?.reference}</span>
                        </DialogDescription>
                    </DialogHeader>
                    {selectedTransaction && (
                        <div className="grid gap-4 py-4">
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
