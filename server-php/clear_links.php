<?php
$pdo = new PDO('sqlite:server-php/database/dev.db');
$pdo->exec('DELETE FROM "ReferralLink"');
echo "ReferralLinks cleared.\n";
