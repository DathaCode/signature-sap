import { LoginForm } from '../../components/auth/LoginForm';

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-md">
                <div className="flex justify-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Signature Shades</h1>
                </div>
                <LoginForm />
            </div>
        </div>
    );
}
