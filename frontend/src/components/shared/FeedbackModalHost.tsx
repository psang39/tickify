import { ErrorModal } from '@/components/shared/ErrorModal';
import { SuccessModal } from '@/components/shared/SuccessModal';
import { useFeedbackStore } from '@/store/useFeedbackStore';

export const FeedbackModalHost = () => {
    const { type, message, closeFeedback } = useFeedbackStore();

    if (type === 'success') {
        return <SuccessModal message={message} onClose={closeFeedback} />;
    }

    if (type === 'error') {
        return <ErrorModal message={message} onClose={closeFeedback} />;
    }

    return null;
};
