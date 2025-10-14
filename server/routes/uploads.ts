import { getUserById, updateUserSettings } from '../db/users';
import express from 'express';
import multer from 'multer';
import requireAuth from '../middleware/auth';
import FormData from 'form-data';
import axios from 'axios';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const CEPHIE_API_KEY = process.env.CEPHIE_API_KEY;
const CEPHIE_UPLOAD_URL = 'https://api.cephie.app/api/v1/pfcontrol/upload';
const CEPHIE_DELETE_URL = 'https://api.cephie.app/api/v1/pfcontrol/delete';

async function deleteOldImage(url: string | undefined) {
    if (!url) return;
    try {
        const response = await axios.delete(CEPHIE_DELETE_URL, {
            headers: {
                'Content-Type': 'application/json',
                'cephie-pfcontrol-key': CEPHIE_API_KEY,
                'cephie-api-key': CEPHIE_API_KEY
            },
            data: { url },
        });
        if (response.status !== 200) {
            console.error('Failed to delete old image:', response.status, response.statusText);
            console.error('Response headers:', response.headers);
            console.error('Response body:', response.data);
            console.error('Request URL:', CEPHIE_DELETE_URL);
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Error deleting old image:', error.response?.data || error.message);
        } else {
            console.error('Error deleting old image:', error);
        }
    }
}

// POST: /api/uploads/upload-background - Upload a new background image

import { Request, Response } from 'express';
import { JwtPayloadClient } from '../types/JwtPayload';

function isJwtPayloadClient(user: unknown): user is JwtPayloadClient {
    return (
        typeof user === 'object' &&
        user !== null &&
        'userId' in user &&
        typeof (user as Record<string, unknown>).userId === 'string'
    );
}

router.post('/upload-background', requireAuth, upload.single('image'), async (req: Request, res: Response) => {
    try {
        const user = req.user;
        if (!isJwtPayloadClient(user)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const userId = user.userId;
        const file = req.file;

        if (!file || !file.mimetype.startsWith('image/')) {
            console.error('Invalid file:', file);
            return res.status(400).json({ error: 'Invalid or missing image file' });
        }

        const dbUser = await getUserById(userId);
        if (!dbUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const currentSettings = dbUser.settings || {};
        const currentImageUrl = currentSettings.backgroundImage?.selectedImage;

        if (currentImageUrl) {
            await deleteOldImage(currentImageUrl);
        }

        const formData = new FormData();
        formData.append('image', file.buffer, file.originalname);

        const uploadResponse = await axios.post(
            CEPHIE_UPLOAD_URL,
            formData,
            {
                headers: {
                    'cephie-pfcontrol-key': CEPHIE_API_KEY,
                    'cephie-api-key': CEPHIE_API_KEY,
                    ...formData.getHeaders(),
                },
                maxBodyLength: Infinity,
            }
        );

        const uploadData = uploadResponse.data;
        const newImageUrl = uploadData.url;
        if (!newImageUrl) {
            return res.status(500).json({ error: 'No URL returned from Cephie upload' });
        }

        const updatedSettings = {
            ...currentSettings,
            backgroundImage: {
                ...currentSettings.backgroundImage,
                selectedImage: newImageUrl,
                useCustomBackground: true,
            },
        };
        await updateUserSettings(userId, updatedSettings);

        res.json({ message: 'Background image uploaded successfully', url: newImageUrl });
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Error uploading background image:', error.response?.data || error.message);
            res.status(500).json({ error: 'Failed to upload background image', details: error.response?.data });
        } else {
            console.error('Error uploading background image:', error);
            res.status(500).json({ error: 'Failed to upload background image' });
        }
    }
});

// DELETE: /api/uploads/delete-background - Delete the current background image
router.delete('/delete-background', requireAuth, async (req: Request, res: Response) => {
    try {
        const user = req.user;
        if (!isJwtPayloadClient(user)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const userId = user.userId;

        const dbUser = await getUserById(userId);
        if (!dbUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const currentSettings = dbUser.settings || {};
        const currentImageUrl = currentSettings.backgroundImage?.selectedImage;

        if (!currentImageUrl) {
            return res.status(400).json({ error: 'No background image to delete' });
        }

        await deleteOldImage(currentImageUrl);

        const updatedSettings = {
            ...currentSettings,
            backgroundImage: {
                ...currentSettings.backgroundImage,
                selectedImage: null,
                useCustomBackground: false,
            },
        };
        await updateUserSettings(userId, updatedSettings);

        res.json({ message: 'Background image deleted successfully' });
    } catch (error) {
        console.error('Error deleting background image:', error);
        res.status(500).json({ error: 'Failed to delete background image' });
    }
});

// GET: /api/uploads/background-url/:filename - Get full URL for a background image
router.get('/background-url/:filename', requireAuth, async (req: express.Request, res: express.Response) => {
    try {
        const { filename } = req.params;

        const backgroundUrl = `/assets/app/backgrounds/${filename}`;

        res.json({ url: backgroundUrl });
    } catch (error) {
        console.error('Error getting background URL:', error);
        res.status(500).json({ error: 'Failed to get background URL' });
    }
});

export default router;