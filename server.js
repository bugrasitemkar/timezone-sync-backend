const express = require('express');
const cors = require('cors');
const moment = require('moment-timezone');
const geoip = require('geoip-lite');
const db = require('./db');

// Temporary test for timezone calculation
console.log('--- Moment-Timezone Test ---');
const testTimezone1 = 'Europe/Istanbul';
const testTimezone2 = 'Asia/Singapore';
const nowForTest = moment();
const testTime1 = nowForTest.tz(testTimezone1);
const testTime2 = nowForTest.tz(testTimezone2);
const testDiffMs = testTime2.diff(testTime1);
const testDiffHours = moment.duration(testDiffMs).asHours();
console.log(`Test difference between ${testTimezone1} and ${testTimezone2}:`);
console.log(`  Time 1: ${testTime1.format()}`);
console.log(`  Time 2: ${testTime2.format()}`);
console.log(`  Diff (ms): ${testDiffMs}`);
console.log(`  Diff (hours): ${testDiffHours}`);
console.log('----------------------------');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Middleware to get timezone from IP
const getTimezoneFromIP = (req, res, next) => {
    console.log('getTimezoneFromIP: Full query object:', req.query); // New Debug log
    const ip = req.ip || req.connection.remoteAddress;
    console.log('getTimezoneFromIP: Detected IP:', ip); // Debug log
    const geo = geoip.lookup(ip);
    console.log('getTimezoneFromIP: Geo data:', geo); // Debug log
    
    let detectedTimezone = null;

    if (geo && geo.timezone) {
        detectedTimezone = geo.timezone;
        console.log('getTimezoneFromIP: Using IP-based timezone:', detectedTimezone); // Debug log
    } else {
        console.warn('getTimezoneFromIP: IP-based timezone detection failed for IP:', ip); // Debug log
    }

    // Check for a testTimezone query parameter if IP detection failed
    if (!detectedTimezone && req.query.testTimezone) {
        detectedTimezone = req.query.testTimezone;
        console.log('getTimezoneFromIP: Using testTimezone query parameter:', detectedTimezone); // Debug log
    }

    // Fallback to a default timezone if no timezone was detected or provided
    req.userTimezone = detectedTimezone || 'UTC';
    console.log('getTimezoneFromIP: Final user timezone:', req.userTimezone); // Debug log

    next();
};

// Helper function to calculate timezone difference
const calculateTimezoneDifference = (timezone1, timezone2) => {
    console.log('Calculating difference between timezones:', timezone1, 'and', timezone2); // Debug log

    try {
        const offset1 = moment.tz(timezone1).utcOffset();
        const offset2 = moment.tz(timezone2).utcOffset();

        console.log('Offset for', timezone1, ':', offset1, 'minutes'); // Debug log
        console.log('Offset for', timezone2, ':', offset2, 'minutes'); // Debug log

        // Calculate the difference in hours
        const diffMinutes = offset2 - offset1;
        const diffHours = diffMinutes / 60;

        console.log('Calculated difference in hours (via offset):', diffHours); // Debug log

        return {
            timezone1,
            timezone2,
            differenceHours: diffHours
        };
    } catch (error) {
        console.error('Error calculating timezone difference:', error); // Debug log
        return {
            timezone1,
            timezone2,
            differenceHours: 0 // Return 0 or handle error appropriately
        };
    }
};

// Sign up endpoint
app.post('/api/signup', (req, res) => {
    const { username, email, timezone, password } = req.body;
    
    if (!username || !email || !timezone || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // In a real app, you would hash the password before storing it
    // For now, we'll just store it as is
    db.run(
        'INSERT INTO users (username, email, timezone, password) VALUES (?, ?, ?, ?)',
        [username, email, timezone, password],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Username or email already exists' });
                }
                return res.status(500).json({ error: 'Database error' });
            }
            res.status(201).json({ id: this.lastID, username, email, timezone });
        }
    );
});

// Login endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    // In a real app, you would hash the password and compare it with the stored hash
    // For now, we'll just compare the plain text passwords
    db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        res.json(user);
    });
});

// Get user profile
app.get('/api/profile/:username', (req, res) => {
    const { username } = req.params;
    
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    });
});

// Get timezone difference
app.get('/api/timezone-diff/:username', getTimezoneFromIP, (req, res) => {
    const { username } = req.params;
    const { isSignedIn, currentUsername } = req.query;
    
    console.log('[/api/timezone-diff/:username] received request - inside handler:'); // Debug log
    console.log('  username (target):', username); // Debug log
    console.log('  isSignedIn:', isSignedIn); // Debug log
    console.log('  currentUsername:', currentUsername); // Debug log
    console.log('  Full query object (inside handler):', req.query); // Debug log

    // If user is signed in, get their timezone from the database
    if (isSignedIn === 'true') {
        // If viewing own profile, return error
        if (currentUsername === username) {
            return res.status(400).json({ error: 'Cannot view timezone difference for own profile' });
        }

        // Get current user's timezone from database
        db.get('SELECT timezone FROM users WHERE username = ?', [currentUsername], (err, currentUser) => {
            if (err) {
                console.error('Database error fetching current user timezone:', err); // Debug log
                return res.status(500).json({ error: 'Database error' });
            }
            if (!currentUser) {
                console.warn('Current user not found for username:', currentUsername); // Debug log
                return res.status(404).json({ error: 'Current user not found' });
            }

            // Get target user's timezone
            db.get('SELECT timezone FROM users WHERE username = ?', [username], (err, targetUser) => {
                if (err) {
                    console.error('Database error fetching target user timezone:', err); // Debug log
                    return res.status(500).json({ error: 'Database error' });
                }
                if (!targetUser) {
                    console.warn('Target user not found for username:', username); // Debug log
                    return res.status(404).json({ error: 'User not found' });
                }

                const diff = calculateTimezoneDifference(currentUser.timezone, targetUser.timezone);
                console.log('Timezone difference calculated:', diff); // Debug log
                res.json({
                    userTimezone: diff.timezone2,
                    visitorTimezone: diff.timezone1,
                    differenceHours: diff.differenceHours
                });
            });
        });
    } else {
        // For unsigned users, use IP-based timezone
        db.get('SELECT timezone FROM users WHERE username = ?', [username], (err, user) => {
            if (err) {
                console.error('Database error fetching user timezone for unsigned user:', err); // Debug log
                return res.status(500).json({ error: 'Database error' });
            }
            if (!user) {
                 console.warn('User not found for username (unsigned):', username); // Debug log
                return res.status(404).json({ error: 'User not found' });
            }

            const diff = calculateTimezoneDifference(req.userTimezone, user.timezone);
             console.log('Timezone difference calculated (unsigned):', diff); // Debug log
            res.json({
                userTimezone: diff.timezone2,
                visitorTimezone: diff.timezone1,
                differenceHours: diff.differenceHours
            });
        });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 