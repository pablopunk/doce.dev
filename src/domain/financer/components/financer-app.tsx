"use client";

import { useEffect, useMemo, useState } from "react";
import { Pie, PieChart, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	ChartContainer,
	ChartLegend,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

const CATEGORY_STORAGE_KEY = "financer_categories";
const EXPENSE_STORAGE_KEY = "financer_expenses";

const COLOR_PALETTE = [
	"#f97316",
	"#22d3ee",
	"#a78bfa",
	"#f472b6",
	"#4ade80",
	"#fb7185",
	"#38bdf8",
	"#facc15",
];

interface Category {
	id: string;
	name: string;
	color: string;
}

interface Expense {
	id: string;
	categoryId: string;
	amount: number;
	note: string;
	createdAt: string;
}

const currencyFormatter = new Intl.NumberFormat(undefined, {
	style: "currency",
	currency: "USD",
	minimumFractionDigits: 2,
});

export function FinancerApp() {
	const [categories, setCategories] = useState<Category[]>([]);
	const [expenses, setExpenses] = useState<Expense[]>([]);
	const [categoryName, setCategoryName] = useState("");
	const [expenseAmount, setExpenseAmount] = useState("");
	const [expenseNote, setExpenseNote] = useState("");
	const [selectedCategory, setSelectedCategory] = useState<string>("");

	useEffect(() => {
		const storedCategories = window.localStorage.getItem(CATEGORY_STORAGE_KEY);
		const storedExpenses = window.localStorage.getItem(EXPENSE_STORAGE_KEY);

		if (storedCategories) {
			try {
				setCategories(JSON.parse(storedCategories));
			} catch {
				setCategories([]);
			}
		}

		if (storedExpenses) {
			try {
				setExpenses(JSON.parse(storedExpenses));
			} catch {
				setExpenses([]);
			}
		}
	}, []);

	useEffect(() => {
		window.localStorage.setItem(
			CATEGORY_STORAGE_KEY,
			JSON.stringify(categories),
		);
	}, [categories]);

	useEffect(() => {
		window.localStorage.setItem(EXPENSE_STORAGE_KEY, JSON.stringify(expenses));
	}, [expenses]);

	const totalsByCategory = useMemo(() => {
		return expenses.reduce<Record<string, number>>((acc, expense) => {
			acc[expense.categoryId] = (acc[expense.categoryId] || 0) + expense.amount;
			return acc;
		}, {});
	}, [expenses]);

	const totalSpent = useMemo(
		() => expenses.reduce((sum, expense) => sum + expense.amount, 0),
		[expenses],
	);

	const chartData = useMemo(() => {
		return categories
			.map((category) => ({
				id: category.id,
				name: category.name,
				value: totalsByCategory[category.id] ?? 0,
				fill: category.color,
			}))
			.filter((item) => item.value > 0);
	}, [categories, totalsByCategory]);

	const chartConfig = useMemo(() => {
		return categories.reduce<Record<string, { label: string; color: string }>>(
			(acc, category) => {
				acc[category.name] = { label: category.name, color: category.color };
				return acc;
			},
			{},
		);
	}, [categories]);

	const handleAddCategory = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const name = categoryName.trim();
		if (!name) return;

		const nextColor = COLOR_PALETTE[categories.length % COLOR_PALETTE.length];
		setCategories((prev) => [
			...prev,
			{ id: crypto.randomUUID(), name, color: nextColor },
		]);
		setCategoryName("");
	};

	const handleAddExpense = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const amount = Number(expenseAmount);

		if (!selectedCategory || Number.isNaN(amount) || amount <= 0) return;

		setExpenses((prev) => [
			{
				id: crypto.randomUUID(),
				categoryId: selectedCategory,
				amount,
				note: expenseNote.trim(),
				createdAt: new Date().toISOString(),
			},
			...prev,
		]);

		setExpenseAmount("");
		setExpenseNote("");
	};

	return (
		<div className="space-y-6">
			<header className="space-y-2">
				<p className="text-sm uppercase tracking-wide text-muted">
					Personal Finance
				</p>
				<h1 className="text-3xl font-semibold text-strong">Financer</h1>
				<p className="text-muted max-w-2xl">
					Track your spending by category, record expenses, and visualize your
					distribution with a quick pie chart. All data stays in your browser.
				</p>
			</header>

			<section className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader>
						<CardTitle>Total Spent</CardTitle>
						<CardDescription>All recorded expenses</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-3xl font-semibold">
							{currencyFormatter.format(totalSpent)}
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Categories</CardTitle>
						<CardDescription>Organize your spending</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-3xl font-semibold">{categories.length}</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Expenses</CardTitle>
						<CardDescription>Entries stored locally</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-3xl font-semibold">{expenses.length}</p>
					</CardContent>
				</Card>
			</section>

			<section className="grid gap-6 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Add Category</CardTitle>
						<CardDescription>
							Group expenses into buckets you care about.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form className="space-y-4" onSubmit={handleAddCategory}>
							<div className="space-y-2">
								<Label htmlFor="category-name">Category Name</Label>
								<Input
									id="category-name"
									placeholder="e.g. Groceries"
									value={categoryName}
									onChange={(event) => setCategoryName(event.target.value)}
									required
								/>
							</div>
							<Button
								type="submit"
								className="w-full"
								disabled={!categoryName.trim()}
							>
								Add Category
							</Button>
						</form>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Add Expense</CardTitle>
						<CardDescription>
							Log what you spent and tag it to a category.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form className="space-y-4" onSubmit={handleAddExpense}>
							<div className="space-y-2">
								<Label>Category</Label>
								<Select
									value={selectedCategory}
									onValueChange={setSelectedCategory}
									required
									disabled={categories.length === 0}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Choose a category" />
									</SelectTrigger>
									<SelectContent>
										{categories.map((category) => (
											<SelectItem key={category.id} value={category.id}>
												<div className="flex items-center gap-2">
													<span
														className="size-2.5 rounded-full"
														style={{ backgroundColor: category.color }}
													/>
													{category.name}
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label htmlFor="expense-amount">Amount</Label>
								<Input
									id="expense-amount"
									type="number"
									step="0.01"
									placeholder="45.80"
									value={expenseAmount}
									onChange={(event) => setExpenseAmount(event.target.value)}
									required
									min="0"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="expense-note">Note</Label>
								<Input
									id="expense-note"
									placeholder="Optional details"
									value={expenseNote}
									onChange={(event) => setExpenseNote(event.target.value)}
								/>
							</div>
							<Button
								type="submit"
								className="w-full"
								disabled={
									!selectedCategory ||
									!Number(expenseAmount) ||
									Number(expenseAmount) <= 0
								}
							>
								Add Expense
							</Button>
						</form>
					</CardContent>
				</Card>
			</section>

			<section className="grid gap-6 lg:grid-cols-2">
				<Card className="min-h-[360px]">
					<CardHeader>
						<CardTitle>Spending Distribution</CardTitle>
						<CardDescription>
							{" "}
							Visual breakdown of expenses by category.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{chartData.length === 0 ? (
							<div className="text-center text-muted text-sm py-12">
								Add expenses to see the distribution.
							</div>
						) : (
							<ChartContainer config={chartConfig} className="mx-auto max-w-md">
								<PieChart>
									<Pie
										data={chartData}
										dataKey="value"
										nameKey="name"
										innerRadius={60}
										strokeWidth={5}
									>
										{chartData.map((item) => (
											<Cell key={item.id} fill={item.fill} />
										))}
									</Pie>
									<ChartTooltip content={<ChartTooltipContent />} />
									<ChartLegend content={<ChartLegend />} />
								</PieChart>
							</ChartContainer>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Category Overview</CardTitle>
						<CardDescription>
							Totals aggregated from your expenses.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{categories.length === 0 ? (
							<p className="text-sm text-muted">
								Create a few categories to begin.
							</p>
						) : (
							<div className="space-y-3">
								{categories.map((category) => (
									<div
										key={category.id}
										className="flex items-center justify-between rounded-md border border-border px-3 py-2"
									>
										<div className="flex items-center gap-3">
											<span
												className="size-2.5 rounded-full"
												style={{ backgroundColor: category.color }}
											/>
											<p className="text-sm font-medium">{category.name}</p>
										</div>
										<Badge variant="secondary">
											{currencyFormatter.format(
												totalsByCategory[category.id] ?? 0,
											)}
										</Badge>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</section>

			<Card>
				<CardHeader>
					<CardTitle>Expenses</CardTitle>
					<CardDescription>Recent entries appear first.</CardDescription>
				</CardHeader>
				<CardContent>
					{expenses.length === 0 ? (
						<p className="text-sm text-muted">No expenses logged yet.</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Date</TableHead>
									<TableHead>Category</TableHead>
									<TableHead className="hidden md:table-cell">Note</TableHead>
									<TableHead className="text-right">Amount</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{expenses.map((expense) => {
									const category = categories.find(
										(c) => c.id === expense.categoryId,
									);
									return (
										<TableRow key={expense.id}>
											<TableCell>
												{new Date(expense.createdAt).toLocaleDateString()}
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-2">
													{category && (
														<span
															className="size-2.5 rounded-full"
															style={{ backgroundColor: category.color }}
														/>
													)}
													<span>{category?.name ?? "Unknown"}</span>
												</div>
											</TableCell>
											<TableCell className="hidden md:table-cell text-muted">
												{expense.note || "—"}
											</TableCell>
											<TableCell className="text-right font-medium">
												{currencyFormatter.format(expense.amount)}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
