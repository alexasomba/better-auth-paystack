export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-xl font-semibold">
        Better Auth + Paystack (OpenNext)
      </h1>
      <p className="mt-4">
        API routes are mounted at <code>/api/auth/*</code>.
      </p>
      <p className="mt-2">
        Set <code>PAYSTACK_SECRET_KEY</code> and{" "}
        <code>PAYSTACK_WEBHOOK_SECRET</code> in your environment.
      </p>
    </main>
  );
}
